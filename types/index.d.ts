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
  | 'session-today'
  | 'day'
  | 'month'
  | 'turn'
  | 'rate'
  | 'cache'
  | 'speed'
  | 'ttft'
export type Slot = 'ok' | 'warn' | 'danger' | 'pace' | 'track' | 'accent'
export type Preset = 'default' | 'ocean' | 'grape' | 'mono'
// Where a session starts: the terminal, or a graphical surface (desktop, VS Code, mobile).
export type StartSurface = 'desktop' | 'terminal'
export type RingSettings = {
  mode: Mode
  lang: Lang
  parts: Record<Part, boolean>
  preset: Preset
  colors: Partial<Record<Slot, string>>
  // Whether a new session on that surface starts with the band shown.
  startShown: Record<StartSurface, boolean>
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
// What this session has spent on `day`, as the ledger records it.
export type RingSessionDay = { day: string; usd: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-rings': {
      snapshot: Snapshot | null
      ledger: Ledger | null
      seenUsd: number | null
      // null until session.start decides it from the surface and startShown.
      isHidden: boolean | null
      minute: number
      settings: RingSettings
      stream: RingStream
      turn: RingTurn
      sessionDay: RingSessionDay | null
    }
  }
}
