export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = {
  contextPercent?: number
  contextTokens?: number
  contextWindow: number
  // The auto-compact window /context measures against, and the count at which compaction runs;
  // absent with auto-compact off or before the first reading.
  compactWindow?: number
  compactAt?: number
  limits: Limit[]
  // Whether `limits` is the last reading saved, from any session (and so maybe another
  // account), until this session's first response reports its own.
  isLimitsStale?: boolean
  sessionUsd?: number
  startedAt?: number
}
export type Ledger = { day: string; dayUsd: number; month: string; monthUsd: number }
// Tokens and cost from the session logs: partial when a log could not be read; the cost leaves
// out responses from a model with no known price.
export type UsageFigure = { tokens: number; usd: number; isPartial: boolean; hasUnpriced: boolean }
// Tokens by kind, what cache reads saved at list price, how many responses, and the tokens and
// cost by model, largest first.
export type UsageMix = {
  input: number
  output: number
  read: number
  write: number
  savedUsd: number
  responses: number
  models: { id: string; tokens: number; usd: number }[]
}
// One day of the week: its local midnight, and what every project used on it.
export type UsageDay = { start: number; tokens: number; usd: number }
// A project folder's last 7 days; `isThis` marks this session's.
export type UsageProject = { name: string; tokens: number; usd: number; isThis: boolean }
export type UsageBook = {
  session: UsageFigure
  project: UsageFigure
  today: UsageFigure
  week: UsageFigure
  // The last 60 minutes, every project.
  hour: UsageFigure
  // Today's mix, every project; and this chat's.
  mix: UsageMix
  chatMix: UsageMix
  days: UsageDay[]
  // Today's tokens by local hour, 0-23.
  hours: number[]
  // The busiest project folders of the last 7 days, at most five.
  projects: UsageProject[]
  // How many sessions (their subagents with them) worked today.
  chats: number
  day: string
}

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
  | 'usage'
export type Slot = 'ok' | 'warn' | 'danger' | 'pace' | 'track' | 'accent'
export type Preset = 'default' | 'ocean' | 'grape' | 'mono'
// Whose spend the today and month figures total: every session's, or this one's.
export type Scope = 'all' | 'session'
// What ctx measures against: the auto-compact window, as the session rail does, or the model's
// whole window.
export type CtxBasis = 'compact' | 'model'
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
  scope: Scope
  ctxBasis: CtxBasis
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
      // null until session.start decides it from the surface and startShown.
      isHidden: boolean | null
      minute: number
      settings: RingSettings
      stream: RingStream
      turn: RingTurn
      // This session's own figures, from the ledger: what the session scope shows.
      own: Ledger | null
      // This conversation's, its project folder's and today's usage, from the session logs.
      usage: UsageBook | null
      // Whether the band's ▾ has opened the usage charts below it.
      isUsageOpen: boolean
    }
  }
}
