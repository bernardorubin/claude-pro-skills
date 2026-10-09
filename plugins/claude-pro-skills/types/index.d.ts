export type Draft = { name: string; path: string; mtimeMs: number; text: string }

export type UsageSnap = {
  context: { tokens?: number; window: number; percent?: number }
  fiveHour: { kind: string; percentUsed: number; resetsAt?: string } | null
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    'claude-pro-skills': { drafts: Draft[]; snap: UsageSnap | null }
  }
}
