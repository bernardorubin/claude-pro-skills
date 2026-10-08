import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Draft } from '../types'
import { clipboardScript, labelOf, toPlain } from './slack-html'

const PANE = 'slack-drafts'
const drafts = atom({ plugin: 'slack-drafts', key: 'drafts' } as const, [])

const home = async ($: EngineInterface) => (await $.env.get('HOME')) ?? ''
const dirOf = async ($: EngineInterface) =>
  (await $.env.get('SLACK_DRAFTS_DIR')) ?? `${await home($)}/Desktop/slack-drafts`

const refresh = async ($: EngineInterface) => {
  const dir = await dirOf($)
  const entries = await $.fs.list(dir).catch(() => [])
  const mds = entries.filter(f => f.kind === 'file' && f.name.endsWith('.md')).sort((a, b) => b.mtimeMs - a.mtimeMs)
  const list: Draft[] = await Promise.all(
    mds.map(async f => ({ name: f.name, path: `${dir}/${f.name}`, mtimeMs: f.mtimeMs, text: await $.fs.read(`${dir}/${f.name}`) })),
  )
  await update($, drafts, () => list)
  return list
}

const copyForSlack = async ($: EngineInterface, d: Draft) => {
  const rich = await $.process.run(['osascript', '-e', clipboardScript(d.text)]).catch(() => null)
  if (rich?.exitCode === 0) return $.ui.toast(`Copied ${labelOf(d.name).who} draft for Slack`)
  await $.process.run(['pbcopy'], { stdin: d.text })
  $.ui.toast('Copied as plain text (the Slack-safe copy failed)')
}

// The phone app writes its own clipboard: plain text only, and iOS Slack converts
// nothing on paste, so it gets the flattened text (bare URLs, no backticks).
const copyOnPhone = async ($: EngineInterface, text: string, what: string) => {
  const r = await $.ui.copy({ text, surface: 'mobile' })
  $.ui.toast(r.isCopied ? `Copied ${what}` : `The app can't copy from a mod yet (${r.reason})`)
}

const copyMarkdown = async ($: EngineInterface, d: Draft) => {
  await $.process.run(['pbcopy'], { stdin: d.text })
  $.ui.toast('Copied the raw markdown')
}

// ponytail: moved to ~/.Trash, not unlinked, so a misclick is recoverable from Finder
const trash = async ($: EngineInterface, d: Draft, url: string) => {
  const to = `${await home($)}/.Trash/${d.name.replace(/\.md$/, '')} ${Date.now()}.md`
  const r = await $.process.run(['mv', d.path, to])
  $.ui.toast(r.exitCode === 0 ? `Moved ${d.name} to the Trash` : `Could not delete: ${r.stderr.trim()}`)
  await syncPhone($, url, await refresh($))
}

// The phone page (an artifact with a db) gets an append-only copy: a new row per
// save and a tombstone per delete; the page shows the newest row per draft and
// tidies the rest. Every row id carries the push time, so a re-push (a fresh
// install starts with an empty `synced` record) adds a duplicate the page folds
// away instead of colliding with an existing row, which the store refuses
// without its version.
const docId = (name: string, at: number) =>
  `${name.replace(/\.md$/, '').replace(/[^A-Za-z0-9_.~:@+-]/g, '_')}-${Math.round(at)}`

// Returns what happened, for /drafts to say; failures also toast.
const syncPhone = async ($: EngineInterface, url: string, list: Draft[]): Promise<string> => {
  if (!url) return 'phone page off (set its URL in /config)'
  const synced = ((await $.store.get('synced')) ?? {}) as Record<string, number>
  const now = Date.now()
  const changed = list.filter(d => synced[d.name] !== d.mtimeMs)
  const gone = Object.keys(synced).filter(name => !list.some(d => d.name === name))
  if (changed.length === 0 && gone.length === 0) return 'phone page up to date'
  const writes = [
    ...changed.map(d => ({ op: 'set' as const, collection: 'drafts', doc_id: docId(d.name, now), data: { name: d.name, md: d.text, savedAt: d.mtimeMs } })),
    ...gone.map(name => ({ op: 'set' as const, collection: 'drafts', doc_id: docId(name, now), data: { name, deleted: true, savedAt: now } })),
  ]
  const r = await $.tool.call({ tool: 'ArtifactData', action: 'batch', url, writes })
  if (r.deny !== undefined || r.isError) {
    const why = (r.deny ?? r.text ?? 'no reason given').slice(0, 160)
    $.ui.toast(`Phone sync failed: ${why}`)
    return `phone sync failed: ${why}`
  }
  const next = Object.fromEntries(list.map(d => [d.name, d.mtimeMs]))
  await $.store.set('synced', next)
  return `sent ${writes.length} change${writes.length === 1 ? '' : 's'} to the phone page`
}

const open = ($: EngineInterface, focus: boolean) =>
  $.ui.open({ id: PANE, title: 'Slack drafts', closeOnEscape: true, ...(focus ? { focus: true as const } : {}) })

export const register: Register = (on, options) => {
  const phoneUrl = String(options.phoneUrl ?? '')

  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await $.command.register({ name: 'drafts', description: 'Show the Slack drafts in a pane' })
    await refresh($)
    return ran
  })

  on('command.run', { command: 'drafts' }, async $ => {
    const list = await refresh($)
    await open($, true)
    const phone = await syncPhone($, phoneUrl, list)
    return { text: `${list.length} draft${list.length === 1 ? '' : 's'} in the pane, ${phone}.` }
  })

  // A draft written by any tool (Write, Edit, a Bash heredoc) refreshes the list,
  // and a new or changed one opens the pane.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.tool === 'ArtifactData' || !JSON.stringify(e).includes('slack-drafts')) return ran
    const newest = (await read($, drafts))[0]?.mtimeMs ?? 0
    const list = await refresh($)
    if ((list[0]?.mtimeMs ?? 0) > newest) void open($, false)
    await syncPhone($, phoneUrl, list)
    return ran
  }).catch(($, e, next) => next(e)) // never block a tool call; next replays its result

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const onPhone = e.surface === 'mobile'
    const list = await read($, drafts)

    if (list.length === 0) {
      return <Text dimColor>No drafts yet. /write-slack-message saves them to ~/Desktop/slack-drafts.</Text>
    }

    return (
      <Box flexDirection="column" gap={1}>
        {list.map((d, i) => {
          const { who, when } = labelOf(d.name)
          return (
            <Box key={`draft-${i}`} flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
              <Box justifyContent="space-between" gap={1}>
                <Box gap={1}>
                  <Text bold>{who}</Text>
                  <Text dimColor>{when}</Text>
                </Box>
                <Box gap={1}>
                  <Button
                    key={`copy-${i}`}
                    label={onPhone ? 'Copy plain' : 'Copy for Slack'}
                    variant="primary" onPress={() => (onPhone ? copyOnPhone($, toPlain(d.text), 'plain text for Slack') : copyForSlack($, d))}
                  />
                  <Button
                    key={`md-${i}`}
                    label="Markdown" onPress={() => (onPhone ? copyOnPhone($, d.text, 'the raw markdown') : copyMarkdown($, d))}
                  />
                  <Button key={`del-${i}`} label="Delete" onPress={() => trash($, d, phoneUrl)} />
                </Box>
              </Box>
              <Markdown text={d.text} />
            </Box>
          )
        })}
      </Box>
    )
  })
}
