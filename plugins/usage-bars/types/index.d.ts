export type UsageSnap = {
  context: { tokens?: number; window: number; percent?: number }
  fiveHour: { kind: string; percentUsed: number; resetsAt?: string } | null
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-bars': { snap: UsageSnap | null }
  }
}
