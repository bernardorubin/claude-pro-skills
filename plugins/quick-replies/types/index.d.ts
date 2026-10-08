export type Ask = { n: number; text: string }
export type Answer = { choice?: 'yes' | 'no' | 'done'; text?: string }

declare module 'claude-code' {
  interface PluginState {
    'quick-replies': { asks: Ask[]; steps: Ask[]; answers: Record<string, Answer>; goAhead: boolean }
  }
}
