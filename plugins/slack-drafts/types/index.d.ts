export type Draft = { name: string; path: string; mtimeMs: number; text: string }

declare module 'claude-code' {
  interface PluginState {
    'slack-drafts': { drafts: Draft[] }
  }
}
