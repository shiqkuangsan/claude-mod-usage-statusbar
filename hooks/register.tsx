import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage, Timer } from 'claude-code'

import type { Ledger, Limit, Snapshot } from '../types'

const snapshot = atom({ plugin: 'usage-rings', key: 'snapshot' } as const, null)
const ledger = atom({ plugin: 'usage-rings', key: 'ledger' } as const, null)
const seenUsd = atom({ plugin: 'usage-rings', key: 'seenUsd' } as const, null)
const isHidden = atom({ plugin: 'usage-rings', key: 'isHidden' } as const, false)
const minute = atom({ plugin: 'usage-rings', key: 'minute' } as const, 0)

// $.store keys, shared by every session.
const LEDGER = 'ledger'
const LIMITS = 'limits'

const TRACK = '#8a8a8a'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const MUTED = '#9a9a9a'
const PHASES = ['○', '◔', '◑', '◕', '●']

type IconName = 'chip' | 'clock' | 'calendar' | 'sparkle' | 'dollar'
type Gauge = { key: string; label: string; percent?: number; detail?: string; icon: IconName }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const money = (usd: number) => `$${usd.toFixed(2)}`
const levelColor = (p: number) => (p < 60 ? GREEN : p < 85 ? AMBER : RED)

const isLedger = (v: unknown): v is Ledger =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Ledger).day === 'string' &&
  typeof (v as Ledger).dayUsd === 'number' &&
  typeof (v as Ledger).month === 'string' &&
  typeof (v as Ledger).monthUsd === 'number'

const isLimitList = (v: unknown): v is Limit[] =>
  Array.isArray(v) && v.every(l => typeof l?.kind === 'string' && typeof l?.percentUsed === 'number')

const toSnapshot = (u: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Snapshot => ({
  contextPercent: u.context.percent,
  contextWindow: u.context.window,
  limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  sessionUsd: u.cost?.usd,
})

const countdown = (resetsAt: string, t: number) => {
  const mins = Math.max(0, Math.round((Date.parse(resetsAt) - t) / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
}

// five_hour and seven_day are the plan windows; a per-model weekly window (e.g.
// seven_day_<model>) shows under the model's name.
const describe = (kind: string): { label: string; icon: IconName } => {
  if (kind === 'five_hour') return { label: '5h', icon: 'clock' }
  if (kind === 'seven_day') return { label: '7d', icon: 'calendar' }
  if (kind === 'spend_limit') return { label: 'spend', icon: 'dollar' }
  const name = kind.replace(/^seven_day_/, '').replace(/_/g, ' ')
  return { label: name.charAt(0).toUpperCase() + name.slice(1), icon: 'sparkle' }
}

const ICONS: Record<IconName, (c: string) => string> = {
  chip: c =>
    `<rect x="14" y="14" width="8" height="8" rx="1.6" fill="none" stroke="${c}" stroke-width="1.7"/>` +
    `<path d="M16 12.6v1.4M20 12.6v1.4M16 22v1.4M20 22v1.4M12.6 16h1.4M12.6 20h1.4M22 16h1.4M22 20h1.4" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`,
  clock: c =>
    `<circle cx="18" cy="18" r="5.6" fill="none" stroke="${c}" stroke-width="1.7"/>` +
    `<path d="M18 15v3.2l2.2 1.3" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`,
  calendar: c =>
    `<rect x="12.8" y="13.8" width="10.4" height="9.4" rx="1.6" fill="none" stroke="${c}" stroke-width="1.7"/>` +
    `<path d="M12.8 17.2h10.4M15.6 12.4v2.6M20.4 12.4v2.6" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`,
  sparkle: c =>
    `<path d="M18 11.8c.6 3.3 2.9 5.6 6.2 6.2-3.3.6-5.6 2.9-6.2 6.2-.6-3.3-2.9-5.6-6.2-6.2 3.3-.6 5.6-2.9 6.2-6.2z" fill="${c}"/>`,
  dollar: c =>
    `<text x="18" y="22.6" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif" font-size="13" font-weight="700" fill="${c}">$</text>`,
}

// A ring gauge: faint track, an arc from 12 o'clock in the level's color, an icon inside.
const ring = (percent: number, color: string, icon: IconName) => {
  const p = clamp(percent, 0, 100)
  const r = 14
  const c = 2 * Math.PI * r
  const arc =
    p > 0
      ? `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" ` +
        `stroke-dasharray="${((c * p) / 100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 18 18)"/>`
      : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">` +
    `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${TRACK}" stroke-opacity="0.3" stroke-width="3.5"/>` +
    arc +
    ICONS[icon](color) +
    `</svg>`
  )
}

async function account($: EngineInterface, usd: number | undefined) {
  if (usd === undefined) return
  const seen = await read($, seenUsd)
  await update($, seenUsd, () => usd)
  const delta = usd - (seen ?? 0)
  if (delta <= 0) return

  const t = await $.clock.now()
  const day = dayKey(t)
  const month = day.slice(0, 7)
  const prev = await $.store.get(LEDGER)
  const last = isLedger(prev) ? prev : null
  const next: Ledger = {
    day,
    month,
    dayUsd: (last?.day === day ? last.dayUsd : 0) + delta,
    monthUsd: (last?.month === month ? last.monthUsd : 0) + delta,
  }
  await $.store.set(LEDGER, next)
  await update($, ledger, () => next)
}

export const register: Register = on => {
  let tick: Timer | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rings',
      description: 'Show or hide the usage rings above the prompt',
    })

    const usage = await $.session.usage()
    const snap = toSnapshot(usage)
    // A fresh session has no rate-limit reading until its first response: show the last one saved.
    if (snap.limits.length === 0) {
      const saved = await $.store.get(LIMITS)
      if (isLimitList(saved)) snap.limits = saved
    }
    await update($, snapshot, () => snap)

    // Count only spend that happens from here on, so a resumed session or a reload adds nothing twice.
    if ((await read($, seenUsd)) === null && usage.cost) {
      const usd = usage.cost.usd
      await update($, seenUsd, () => usd)
    }
    const saved = await $.store.get(LEDGER)
    if (isLedger(saved)) await update($, ledger, () => saved)

    // Redraw once a minute so the reset countdowns stay current.
    tick?.cancel()
    tick = $.clock.every(60_000, () => {
      void update($, minute, n => n + 1)
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const snap = toSnapshot(e)
    if (snap.limits.length > 0) await $.store.set(LIMITS, snap.limits)
    else {
      const prev = await read($, snapshot)
      snap.limits = prev?.limits ?? []
    }
    await update($, snapshot, () => snap)
    await account($, e.cost?.usd)

    return next(e)
  })

  on('command.run', { command: 'rings' }, async $ => {
    const hidden = await update($, isHidden, h => !h)
    return { text: hidden ? 'Usage rings hidden. Run /rings to show them again.' : 'Usage rings shown.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null || (await read($, isHidden))) return next(e)

    await read($, minute)
    const t = await $.clock.now()
    const book = await read($, ledger)
    const today = dayKey(t)
    const dayUsd = book?.day === today ? book.dayUsd : 0
    const monthUsd = book?.month === today.slice(0, 7) ? book.monthUsd : 0
    const sessionUsd = snap.sessionUsd ?? 0

    const gauges: Gauge[] = [
      { key: 'ctx', label: 'ctx', percent: snap.contextPercent, icon: 'chip' },
      ...snap.limits.map(l => {
        // A window whose reset time has passed starts over until fresh data arrives.
        const expired = l.resetsAt !== undefined && Date.parse(l.resetsAt) <= t
        const { label, icon } = describe(l.kind)
        return {
          key: l.kind,
          label,
          icon,
          percent: expired ? 0 : l.percentUsed,
          detail: l.resetsAt && !expired ? countdown(l.resetsAt, t) : undefined,
        }
      }),
    ]

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui

    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      const pctText = (g: Gauge) => (g.percent === undefined ? '–' : `${Math.round(g.percent)}%`)
      return (
        <Box flexDirection="column" gap={1} paddingY={1}>
          <Box flexDirection="row" flexWrap="wrap" columnGap={4} rowGap={1} alignItems="center">
            {gauges.map(g => {
              const color = g.percent === undefined ? MUTED : levelColor(g.percent)
              return (
                <Box key={g.key} flexDirection="row" gap={1} alignItems="center">
                  <Svg
                    source={ring(g.percent ?? 0, color, g.icon)}
                    alt={`${g.label} ${pctText(g)} used`}
                    width={30}
                    height={30}
                  />
                  <Text weight="semibold" tabular>
                    {pctText(g)}
                  </Text>
                  <Text dimColor>{g.detail ? `${g.label} · ${g.detail}` : g.label}</Text>
                </Box>
              )
            })}
          </Box>
          <Box flexDirection="row" gap={2} alignItems="center">
            <Svg
              source={ring(dayUsd > 0 ? (sessionUsd / dayUsd) * 100 : 100, GREEN, 'dollar')}
              alt={`Session spend ${money(sessionUsd)}`}
              width={30}
              height={30}
            />
            <Text weight="semibold" color={GREEN} tabular>
              {money(sessionUsd)}
            </Text>
            <Text tabular>{money(dayUsd)}</Text>
            <Text dimColor>day</Text>
            <Text tabular>{money(monthUsd)}</Text>
            <Text dimColor>mo</Text>
          </Box>
        </Box>
      )
    }

    // Terminal: no vector element, so a quarter-step circle glyph stands in for each ring.
    const glyph = (p: number) => PHASES[Math.min(4, Math.round(clamp(p, 0, 100) / 25))]
    const line = gauges
      .map(g => {
        const head = g.percent === undefined ? `○ –` : `${glyph(g.percent)} ${Math.round(g.percent)}%`
        return `${head} ${g.label}${g.detail ? ` ${g.detail}` : ''}`
      })
      .join('   ')
    return (
      <Box flexDirection="column">
        <Text dimColor>{line}</Text>
        <Text dimColor>
          {money(sessionUsd)} session   {money(dayUsd)} day   {money(monthUsd)} mo
        </Text>
      </Box>
    )
  })
}
