import { expect, test } from 'claude-code/testing'

const REPLY = 'Done.\n\n**Next steps:**\n1. Build it.\n\n**I need from you:**\n2. Run `/reload-plugins`.\n3. Should I commit? Yes or no.\n'
const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 19 }, view: {} },
}

test('draws the asks on terminal and desktop, and sends the picked answers', async ($, on) => {
  const sent: string[] = []
  const ran: string[] = []
  on('command.run', ($, e) => {
    ran.push(e.command)
    return { text: '' }
  })
  on('turn.complete', () => ({ text: '' }))
  // stands in for the engine's own band beneath the mod
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  await $.turn.complete({ answer: REPLY, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'quick-replies', surface, ...BAND })
    expect(await ui.find({ key: 'run-2' })).toBeDefined()
    expect(await ui.find({ key: 'done-2' })).toBeDefined()
    expect(await ui.find({ key: 'yes-2' })).toBeUndefined()
    expect(await ui.find({ key: 'no-3' })).toBeDefined()
    expect(await ui.find({ key: 'text-3' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'quick-replies', surface: 'desktop', ...BAND })
  await ui.press({ key: 'go' })
  await ui.press({ key: 'run-2' })
  await ui.press({ key: 'yes-3' })
  await ui.input({ key: 'text-3', text: 'not yet', kind: 'change' })
  await ui.press({ key: 'send' })
  expect(ran).toEqual(['reload-plugins'])
  expect(sent).toEqual(['Go ahead with the next steps.\n2. done\n3. yes: not yet'])
  expect(await ui.find({ key: 'yes-3' })).toBeUndefined()
  await ui.unmount()
})
