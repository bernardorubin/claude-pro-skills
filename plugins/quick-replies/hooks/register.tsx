import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Answer } from '../types'
import { GO_AHEAD, commandOf, composeReply, kindOf, parseAsks, parseSteps } from './asks'

const asksAtom = atom({ plugin: 'quick-replies', key: 'asks' } as const, [])
const stepsAtom = atom({ plugin: 'quick-replies', key: 'steps' } as const, [])
const answersAtom = atom({ plugin: 'quick-replies', key: 'answers' } as const, {})
const goAheadAtom = atom({ plugin: 'quick-replies', key: 'goAhead' } as const, false)

const load = async ($: EngineInterface, answer: string) => {
  await update($, asksAtom, () => parseAsks(answer))
  await update($, stepsAtom, () => parseSteps(answer))
  await update($, answersAtom, () => ({}))
  await update($, goAheadAtom, () => false)
}

const setAnswer = ($: EngineInterface, n: number, change: (a: Answer) => Answer) =>
  update($, answersAtom, all => ({ ...all, [n]: change(all[n] ?? {}) }))

export const register: Register = on => {
  // Each main-thread answer replaces the band: a reply without the lists clears it.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined && !e.isAborted) await load($, e.answer)
    return done
  })

  // Typing a reply by hand answers them too.
  on('prompt.submit', async ($, e, next) => {
    await load($, '')
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const asks = await read($, asksAtom)
    const steps = await read($, stepsAtom)
    if (e.props.hasSurvey || (asks.length === 0 && steps.length === 0)) return next(e)

    const answers = await read($, answersAtom)
    const goAhead = await read($, goAheadAtom)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button, Markdown } = ui
    const theirs = await next(e)

    const submit = async (text: string) => {
      await load($, '')
      await $.prompt.submit({ text })
    }
    const send = async () => {
      const text = composeReply(asks, answers, goAhead)
      if (!text) {
        $.ui.toast('Answer at least one item, or press Go ahead, first')
        return
      }
      await submit(text)
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={1}>
          {steps.length > 0 && (
            <Box flexDirection="column">
              <Text dimColor>Claude's next steps</Text>
              {steps.map(({ n, text }) => (
                <Markdown key={`step-${n}`} text={`${n}. ${text}`} dimColor />
              ))}
              <Box gap={1}>
                {asks.length === 0 ? (
                  <Button key="go" label="Go ahead" variant="primary" onPress={() => submit(GO_AHEAD)} />
                ) : (
                  <Button
                    key="go"
                    label={goAhead ? 'Going ahead ✓' : 'Go ahead with these'}
                    variant={goAhead ? 'primary' : 'secondary'}
                    onPress={() => update($, goAheadAtom, v => !v)}
                  />
                )}
              </Box>
            </Box>
          )}
          {asks.length > 0 && <Text bold>Claude needs from you</Text>}
          {asks.map(({ n, text }) => {
            const a = answers[n] ?? {}
            const kind = kindOf(text)
            const cmd = kind === 'action' ? commandOf(text) : undefined
            const pick = (choice: 'yes' | 'no' | 'done') => () =>
              setAnswer($, n, prev => ({ ...prev, choice: prev.choice === choice ? undefined : choice }))
            const choiceButton = (choice: 'yes' | 'no' | 'done', label: string) => (
              <Button key={`${choice}-${n}`} label={label} variant={a.choice === choice ? 'primary' : 'secondary'} onPress={pick(choice)} />
            )
            const run = async () => {
              if (!cmd) return
              await setAnswer($, n, prev => ({ ...prev, choice: 'done' }))
              await $.command
                .run({ command: cmd.command, ...(cmd.args ? { args: cmd.args } : {}) })
                .catch((error: unknown) => $.ui.toast(`Could not run /${cmd.command}: ${error instanceof Error ? error.message : String(error)}`))
            }
            return (
              <Box key={`ask-${n}`} flexDirection="column">
                <Markdown text={`${n}. ${text}`} />
                {kind !== 'open' && (
                  <Box gap={1}>
                    {kind === 'yesno' && choiceButton('yes', 'Yes')}
                    {kind === 'yesno' && choiceButton('no', 'No')}
                    {cmd && <Button key={`run-${n}`} label={`Run /${cmd.command}`} variant="primary" onPress={run} />}
                    {kind === 'action' && choiceButton('done', 'Done')}
                  </Box>
                )}
                {'Input' in ui && (
                  // ponytail: its own full-width row, so long replies wrap instead of shoving the buttons
                  <Box width="100%">
                    <ui.Input
                      key={`text-${n}`}
                      placeholder={kind === 'action' ? 'or tell Claude what happened' : kind === 'open' ? 'your answer' : 'or reply in words'}
                      value={a.text ?? ''}
                      onInput={value => void setAnswer($, n, prev => ({ ...prev, text: value }))}
                      onSubmit={value => void setAnswer($, n, prev => ({ ...prev, text: value }))}
                    />
                  </Box>
                )}
              </Box>
            )
          })}
          <Box gap={1}>
            {asks.length > 0 && <Button key="send" label="Send answers" variant="primary" onPress={send} />}
            <Button key="dismiss" label="Dismiss" onPress={() => load($, '')} />
          </Box>
        </Box>
        {theirs}
      </Box>
    )
  })
}
