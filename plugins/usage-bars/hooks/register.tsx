import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { UsageSnap } from '../types'

const snap = atom({ plugin: 'usage-bars', key: 'snap' } as const, null)

const WIDTH = 20
const BLUE = '#88c0d0'
const ORANGE = '#d08770'
const RED = '#bf616a'

export const bar = (pct: number) => {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * WIDTH)
  return '■'.repeat(filled) + '□'.repeat(WIDTH - filled)
}

export const tokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`

export const timeLeft = (resetsAt: string | undefined, now: number) => {
  const ms = resetsAt ? Date.parse(resetsAt) - now : NaN
  if (!(ms > 0)) return 'resetting'
  const m = Math.ceil(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export const tone = (pct: number, warn: number, crit: number) => (pct >= crit ? RED : pct >= warn ? ORANGE : BLUE)

const BAR_PX = 160
const ROW_PX = 18
const svgBar = (pct: number, color: string) => {
  const fill = Math.round((Math.min(100, Math.max(0, pct)) / 100) * BAR_PX)
  const rect = (w: number, opacity: number) =>
    `<rect x="0" y="${(ROW_PX - 6) / 2}" width="${w}" height="6" rx="3" fill="${color}" fill-opacity="${opacity}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_PX}" height="${ROW_PX}" viewBox="0 0 ${BAR_PX} ${ROW_PX}">${rect(BAR_PX, 0.22)}${fill > 0 ? rect(Math.max(fill, 6), 1) : ''}</svg>`
}

const save = async (
  $: EngineInterface,
  u: { context: SessionContextUsage; rateLimits: SessionRateLimit[] },
) => {
  const next: UsageSnap = {
    context: u.context,
    fiveHour: u.rateLimits.find(r => r.kind === 'five_hour') ?? null,
    now: await $.clock.now(),
  }
  await update($, snap, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await save($, await $.session.usage())
    // ponytail: 60s tick only so the reset countdown moves while idle
    $.clock.every(60_000, () => void $.session.usage().then(u => save($, u)))
    return ran
  })

  on('session.measure', async ($, e, next) => {
    await save($, e)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snap)
    if (e.props.hasSurvey || s === null) return next(e)

    const els = $.ui.resolve(e)
    const { Box, Text } = els
    const meter = (pct: number, color: string, alt: string) =>
      'Svg' in els ? (
        <els.Svg source={svgBar(pct, color)} alt={alt} width={BAR_PX} height={ROW_PX} />
      ) : (
        <Text color={color}>{bar(pct)}</Text>
      )

    const ctxPct = Math.round(s.context.percent ?? 0)
    const ctxTokens = s.context.tokens === undefined ? '—' : tokens(s.context.tokens)
    const used = s.fiveHour?.percentUsed ?? 0
    const left = Math.round(100 - used)
    const ctxTone = tone(ctxPct, 60, 85)
    const fiveTone = tone(used, 75, 90)
    const alert = (c: string) => (c === BLUE ? undefined : c)
    const fiveDetail =
      s.fiveHour === null ? 'no reading yet' : `left · resets in ${timeLeft(s.fiveHour.resetsAt, s.now)}`

    // ponytail: columns, not rows, so labels and bars line up on any font
    return (
      <Box gap={2}>
        <Box flexDirection="column">
          <Text dimColor>ctx</Text>
          <Text dimColor>5h</Text>
        </Box>
        <Box flexDirection="column">
          {meter(ctxPct, ctxTone, `context ${ctxPct}% used`)}
          {meter(s.fiveHour === null ? 0 : left, fiveTone, `5-hour window ${left}% left`)}
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Text bold color={alert(ctxTone)}>
            {ctxPct}%
          </Text>
          <Text bold color={alert(fiveTone)}>
            {s.fiveHour === null ? '—' : `${left}%`}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text dimColor>
            used · {ctxTokens} of {tokens(s.context.window)}
          </Text>
          <Text dimColor>{fiveDetail}</Text>
        </Box>
      </Box>
    )
  })
}
