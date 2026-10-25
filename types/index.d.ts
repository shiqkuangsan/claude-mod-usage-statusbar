export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  contextPercent?: number
  contextWindow: number
  limits: Limit[]
  sessionUsd?: number
}

// Spend summed across sessions, kept in $.store and mirrored into state for drawing.
export type Ledger = { day: string; dayUsd: number; month: string; monthUsd: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-rings': {
      snapshot: Snapshot | null
      ledger: Ledger | null
      seenUsd: number | null
      isHidden: boolean
      minute: number
    }
  }
}
