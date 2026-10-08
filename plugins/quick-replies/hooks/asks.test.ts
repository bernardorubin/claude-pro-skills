import { expect, test } from 'claude-code/testing'

import { GO_AHEAD, composeReply, parseAsks, parseSteps } from './asks'

const REPLY = `Done.

**Next steps:**
1. Build the thing.

**I need from you:**
2. Run \`/reload-plugins\`.
3. Should I commit? Yes or no.
`

test('finds the numbered asks under the heading', async () => {
  expect(parseAsks(REPLY)).toEqual([
    { n: 2, text: 'Run `/reload-plugins`.' },
    { n: 3, text: 'Should I commit? Yes or no.' },
  ])
  expect(parseAsks('No asks here.\n1. a list')).toEqual([])
  expect(parseAsks('I need from you:\n1. one\n\nTrailing prose.')).toEqual([{ n: 1, text: 'one' }])
})

test('composes one line per answered ask', async () => {
  const asks = parseAsks(REPLY)
  expect(composeReply(asks, { 2: { choice: 'yes' }, 3: { choice: 'no', text: 'not yet' } })).toBe('2. yes\n3. no: not yet')
  expect(composeReply(asks, { 3: { text: 'later' } })).toBe('3. later')
  expect(composeReply(asks, {})).toBe('')
})

test('reads the next steps and puts the go-ahead first', async () => {
  expect(parseSteps(REPLY)).toEqual([{ n: 1, text: 'Build the thing.' }])
  expect(composeReply(parseAsks(REPLY), { 2: { choice: 'yes' } }, true)).toBe(`${GO_AHEAD}\n2. yes`)
  expect(composeReply([], {}, true)).toBe(GO_AHEAD)
})
