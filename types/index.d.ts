export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = {
  contextPercent?: number
  contextTokens?: number
  contextWindow: number
  limits: Limit[]
  sessionUsd?: number
  startedAt?: number
}
export type Ledger = { day: string; dayUsd: number; month: string; monthUsd: number }

export type Mode = 'tiles' | 'minimal'
export type Lang = 'en' | 'zh'
export type Part =
  | 'ctx'
  | '5h'
  | '7d'
  | 'models'
  | 'resets'
  | 'pace'
  | 'forecast'
  | 'session'
  | 'day'
  | 'month'
  | 'turn'
  | 'rate'
  | 'cache'
  | 'speed'
  | 'ttft'
export type Slot = 'ok' | 'warn' | 'danger' | 'pace' | 'track' | 'accent'
export type Preset = 'default' | 'ocean' | 'grape' | 'mono'
export type RingSettings = {
  mode: Mode
  lang: Lang
  parts: Record<Part, boolean>
  preset: Preset
  colors: Partial<Record<Slot, string>>
}

// The model's output speed for the main loop: live while a response streams, exact once it ends.
export type RingStream = {
  isStreaming: boolean
  live?: number
  last?: number
  ttftMs?: number
  cacheHit?: number
}
export type RingTurn = { startUsd: number | null; usd: number | null }

declare module 'claude-code' {
  interface PluginState {
    'usage-rings': {
      snapshot: Snapshot | null
      ledger: Ledger | null
      seenUsd: number | null
      isHidden: boolean
      minute: number
      settings: RingSettings
      stream: RingStream
      turn: RingTurn
    }
  }
}
