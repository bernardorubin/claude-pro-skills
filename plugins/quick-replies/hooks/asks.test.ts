import { expect, test } from 'claude-code/testing'

import { GO_AHEAD, commandOf, composeReply, kindOf, parseAsks, parseSteps } from './asks'

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

test('tells decisions, open questions and actions apart', async () => {
  expect(kindOf('Should I commit? Yes or no.')).toBe('yesno')
  expect(kindOf('Want me to publish it?')).toBe('yesno')
  expect(kindOf('Which name do you prefer, slack-drafts or drafts?')).toBe('open')
  expect(kindOf('Run `/reload-plugins`. The buttons come back from my next reply.')).toBe('action')
  expect(commandOf('Run `/reload-plugins`. The buttons come back.')).toEqual({ command: 'reload-plugins', args: '' })
  expect(commandOf('Run `/skin band on`.')).toEqual({ command: 'skin', args: 'band on' })
  expect(commandOf('Open the page on your iPhone.')).toBeUndefined()
})
