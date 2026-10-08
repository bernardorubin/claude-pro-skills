import type { Answer, Ask } from '../types'

const ITEM = /^\s*(\d+)\.\s+(.+)$/
const headingOf = (title: string) =>
  new RegExp(`^\\s*(\\*\\*|__)?\\s*${title}\\s*:?\\s*(\\*\\*|__)?\\s*:?\\s*$`, 'i')

// The numbered items under a reply's "<title>:" heading, in order.
const section = (answer: string, title: string): Ask[] => {
  const lines = answer.split(/\r?\n/)
  const heading = headingOf(title)
  const start = lines.findIndex(line => heading.test(line))
  if (start === -1) return []
  const items: Ask[] = []
  for (const line of lines.slice(start + 1)) {
    const item = ITEM.exec(line)
    if (item) items.push({ n: Number(item[1]), text: (item[2] ?? '').trim() })
    else if (line.trim() !== '' && items.length > 0) break
  }
  return items
}

export const parseAsks = (answer: string) => section(answer, 'I need from you')
export const parseSteps = (answer: string) => section(answer, 'Next steps')

export const GO_AHEAD = 'Go ahead with the next steps.'

// One line per answered ask ("1. yes", "2. no: text", "3. text"), after the go-ahead.
export const composeReply = (asks: Ask[], answers: Record<string, Answer>, goAhead = false) =>
  [
    goAhead ? GO_AHEAD : '',
    ...asks.map(({ n }) => {
      const a = answers[n] ?? {}
      const text = a.text?.trim() ?? ''
      if (!a.choice && !text) return ''
      return `${n}. ${[a.choice, text].filter(Boolean).join(': ')}`
    }),
  ]
    .filter(Boolean)
    .join('\n')
