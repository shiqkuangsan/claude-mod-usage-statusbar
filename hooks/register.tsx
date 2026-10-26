import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage, Timer } from 'claude-code'

import type { Ledger, Limit, Mode, Part, Preset, RingSettings, Scope, Slot, Snapshot, StartSurface } from '../types'

const PART_IDS: Part[] = [
  'ctx',
  '5h',
  '7d',
  'models',
  'resets',
  'pace',
  'forecast',
  'session',
  'day',
  'month',
  'turn',
  'rate',
  'cache',
  'speed',
  'ttft',
]
const OFF_BY_DEFAULT: Part[] = ['turn', 'rate', 'cache', 'ttft']

const SLOTS: Slot[] = ['ok', 'warn', 'danger', 'pace', 'track', 'accent']
const PRESETS: Record<Preset, Record<Slot, string>> = {
  default: { ok: '#22c55e', warn: '#f59e0b', danger: '#ef4444', pace: '#a3a3a3', track: '#8a8a8a', accent: '#22c55e' },
  ocean: { ok: '#38bdf8', warn: '#fbbf24', danger: '#f43f5e', pace: '#94a3b8', track: '#64748b', accent: '#38bdf8' },
  grape: { ok: '#a78bfa', warn: '#f472b6', danger: '#ef4444', pace: '#a3a3a3', track: '#8a8a8a', accent: '#a78bfa' },
  mono: { ok: '#a3a3a3', warn: '#d97706', danger: '#dc2626', pace: '#737373', track: '#8a8a8a', accent: '#a3a3a3' },
}

const DEFAULTS: RingSettings = {
  mode: 'tiles',
  lang: 'en',
  parts: Object.fromEntries(PART_IDS.map(id => [id, !OFF_BY_DEFAULT.includes(id)])) as Record<Part, boolean>,
  preset: 'default',
  colors: {},
  startShown: { desktop: true, terminal: false },
  scope: 'all',
}
const START_SURFACES: StartSurface[] = ['desktop', 'terminal']

// Every word the mod shows, in each language it speaks.
const TEXT = {
  en: {
    parts: {
      ctx: 'Context',
      '5h': '5h limit',
      '7d': '7d limit',
      models: 'Other limits',
      resets: 'Reset countdown',
      pace: 'Pace tick',
      forecast: 'Forecast',
      session: 'Session spend',
      day: 'Today spend',
      month: 'Month spend',
      turn: 'Turn spend',
      rate: 'Spend per hour',
      cache: 'Cache hits',
      speed: 'Tokens/s',
      ttft: 'First token',
    } as Record<Part, string>,
    slots: { ok: 'ok', warn: 'warn', danger: 'danger', pace: 'pace tick', track: 'track', accent: 'accent' } as Record<
      Slot,
      string
    >,
    ctx: 'ctx',
    spendLimit: 'spend',
    full: (x: string) => `full ~${x}`,
    lasts: 'lasts to reset',
    used: (label: string, p: string) => `${label}: ${p} used`,
    resetsIn: (x: string) => `resets in ${x}`,
    gone: (p: number) => `${p}% of the window gone`,
    sessionLabel: 'session',
    totals: (scope: Scope, figures: string) => `${scope === 'all' ? 'all' : 'session'}: ${figures}`,
    today: (v: string) => `today ${v}`,
    month: (v: string) => `mo ${v}`,
    turn: (v: string) => `${v}/turn`,
    rate: (v: string) => `${v}/h`,
    cache: (p: number) => `${p}% cache`,
    ttft: (s: string) => `ttft ${s}s`,
    paneTitle: 'Usage rings',
    layout: 'Layout',
    modes: { tiles: 'Tiles', minimal: 'Minimal' } as Record<Mode, string>,
    theme: 'Theme',
    language: 'Language',
    show: 'Show',
    colors: 'Colors',
    colorHint: 'Empty a color field to follow the theme. #rgb or #rrggbb.',
    scope: 'Totals',
    scopes: { all: 'All sessions', session: 'This session' } as Record<Scope, string>,
    startTitle: 'Show in new sessions',
    surfaces: { desktop: 'Desktop', terminal: 'Terminal' } as Record<StartSurface, string>,
    resetAll: 'Reset to defaults',
    done: 'Done',
    set: 'set',
    hidden: 'Usage rings hidden. Run /rings to show them again.',
    shown: 'Usage rings shown.',
    opened: 'Usage rings settings opened.',
    notOpened: (why: string) => `Settings pane not shown: ${why}`,
    modeHelp: 'Modes: tiles, minimal.',
    modeSet: (m: string) => `Layout: ${m}.`,
    langHelp: 'Languages: en, zh.',
    langSet: 'Language: English.',
    scopeHelp: 'Totals: all (every session), session (this one).',
    scopeSet: (x: Scope) => `Today and month now total ${x === 'all' ? 'every session' : 'this session'}.`,
    partsHelp: (all: string) => `Name one or more parts: ${all}, all.`,
    partsSet: (on: boolean, ids: string, unknown: string) =>
      `${on ? 'Showing' : 'Hiding'} ${ids}.${unknown ? ` Unknown: ${unknown}.` : ''}`,
    themeHelp: (all: string) => `Themes: ${all}.`,
    themeSet: (t: string) => `Theme: ${t}.`,
    slotHelp: (all: string) => `Color slots: ${all}.`,
    colorBad: 'Give the color as #rgb or #rrggbb, or reset.',
    colorReset: (slot: string) => `${slot} follows the theme again.`,
    colorSet: (slot: string, v: string) => `${slot}: ${v}.`,
    resetDone: 'Usage rings settings reset to defaults.',
    defaultHelp: (now: string) => `Usage: /rings default desktop|terminal on|off. New sessions now: ${now}.`,
    defaultNow: (surface: string, on: boolean) => `${surface} ${on ? 'shown' : 'hidden'}`,
    defaultSet: (surface: string, on: boolean) =>
      `New ${surface} sessions start with the band ${on ? 'shown' : 'hidden'}. This session is unchanged; /rings toggles it.`,
    help: (parts: string, themes: string, slots: string) =>
      [
        'Usage: /rings [settings | mode tiles|minimal | lang en|zh | scope all|session | show <parts> | hide <parts> | theme <name> | color <slot> <#hex|reset> | default desktop|terminal on|off | reset]',
        `Parts: ${parts}, all`,
        `Themes: ${themes}`,
        `Color slots: ${slots}`,
        'Run /rings alone to hide or show the band in this session.',
      ].join('\n'),
  },
  zh: {
    parts: {
      ctx: '上下文',
      '5h': '5h 额度',
      '7d': '7d 额度',
      models: '其他额度',
      resets: '重置倒计时',
      pace: '时间刻度',
      forecast: '用满预测',
      session: '本会话花费',
      day: '今日花费',
      month: '本月花费',
      turn: '本轮花费',
      rate: '每小时花费',
      cache: '缓存命中',
      speed: '输出速度',
      ttft: '首 token',
    } as Record<Part, string>,
    slots: { ok: '正常', warn: '警告', danger: '危险', pace: '时间刻度', track: '底环', accent: '强调' } as Record<
      Slot,
      string
    >,
    ctx: '上下文',
    spendLimit: '花费上限',
    full: (x: string) => `约 ${x} 用满`,
    lasts: '撑得到重置',
    used: (label: string, p: string) => `${label}：已用 ${p}`,
    resetsIn: (x: string) => `${x} 后重置`,
    gone: (p: number) => `时间已过 ${p}%`,
    sessionLabel: '本会话',
    totals: (scope: Scope, figures: string) => `${scope === 'all' ? '全部' : '本会话'}：${figures}`,
    today: (v: string) => `今日 ${v}`,
    month: (v: string) => `本月 ${v}`,
    turn: (v: string) => `本轮 ${v}`,
    rate: (v: string) => `${v}/小时`,
    cache: (p: number) => `缓存 ${p}%`,
    ttft: (s: string) => `首 token ${s}s`,
    paneTitle: '用量圆环',
    layout: '布局',
    modes: { tiles: '双行小卡', minimal: '极简' } as Record<Mode, string>,
    theme: '主题',
    language: '语言',
    show: '显示',
    colors: '颜色',
    colorHint: '清空颜色框即跟随主题。格式 #rgb 或 #rrggbb。',
    scope: '合计范围',
    scopes: { all: '所有会话', session: '本会话' } as Record<Scope, string>,
    startTitle: '新会话默认显示',
    surfaces: { desktop: '桌面端', terminal: '终端' } as Record<StartSurface, string>,
    resetAll: '恢复默认',
    done: '完成',
    set: '设置',
    hidden: '用量圆环已隐藏，再次运行 /rings 显示。',
    shown: '用量圆环已显示。',
    opened: '已打开用量圆环设置。',
    notOpened: (why: string) => `设置面板未显示：${why}`,
    modeHelp: '布局：tiles、minimal。',
    modeSet: (m: string) => `布局：${m}。`,
    langHelp: '语言：en、zh。',
    langSet: '语言：中文。',
    scopeHelp: '合计范围：all（所有会话）、session（本会话）。',
    scopeSet: (x: Scope) => `今日和本月现在统计${x === 'all' ? '所有会话' : '本会话'}。`,
    partsHelp: (all: string) => `请写出一个或多个组件：${all}、all。`,
    partsSet: (on: boolean, ids: string, unknown: string) =>
      `已${on ? '显示' : '隐藏'} ${ids}。${unknown ? `未知：${unknown}。` : ''}`,
    themeHelp: (all: string) => `主题：${all}。`,
    themeSet: (t: string) => `主题：${t}。`,
    slotHelp: (all: string) => `颜色槽：${all}。`,
    colorBad: '颜色请写成 #rgb 或 #rrggbb，或写 reset。',
    colorReset: (slot: string) => `${slot} 已恢复跟随主题。`,
    colorSet: (slot: string, v: string) => `${slot}：${v}。`,
    resetDone: '用量圆环设置已恢复默认。',
    defaultHelp: (now: string) => `用法：/rings default desktop|terminal on|off。当前新会话：${now}。`,
    defaultNow: (surface: string, on: boolean) => `${surface}${on ? '显示' : '隐藏'}`,
    defaultSet: (surface: string, on: boolean) =>
      `${surface}新会话默认${on ? '显示' : '隐藏'}面板。当前会话不变，可用 /rings 切换。`,
    help: (parts: string, themes: string, slots: string) =>
      [
        '用法：/rings [settings | mode tiles|minimal | lang en|zh | scope all|session | show <组件> | hide <组件> | theme <名称> | color <槽> <#hex|reset> | default desktop|terminal on|off | reset]',
        `组件：${parts}、all`,
        `主题：${themes}`,
        `颜色槽：${slots}`,
        '单独运行 /rings 在当前会话隐藏或显示面板。',
      ].join('\n'),
  },
}
type Words = (typeof TEXT)['en']

const snapshot = atom({ plugin: 'usage-rings', key: 'snapshot' } as const, null)
const ledger = atom({ plugin: 'usage-rings', key: 'ledger' } as const, null)
const seenUsd = atom({ plugin: 'usage-rings', key: 'seenUsd' } as const, null)
const isHidden = atom({ plugin: 'usage-rings', key: 'isHidden' } as const, null)
const minute = atom({ plugin: 'usage-rings', key: 'minute' } as const, 0)
const settings = atom({ plugin: 'usage-rings', key: 'settings' } as const, DEFAULTS)
const stream = atom({ plugin: 'usage-rings', key: 'stream' } as const, { isStreaming: false })
const turn = atom({ plugin: 'usage-rings', key: 'turn' } as const, { startUsd: null, usd: null })
const own = atom({ plugin: 'usage-rings', key: 'own' } as const, null)

// $.store keys, shared by every session. A session's spend on a day is one figure under
// USD + `<day>:<session id>:<startedAt>`, set (never added to), so a reload or a resume
// cannot count it twice; BASE + the same holds what it had cost when that day began.
// LEDGER (0.3.0) and SPEND (0.3.1) are the older ledgers, read only for days before SINCE,
// the day this scheme first ran.
const USD = 'usd:'
const BASE = 'base:'
// The same for a month: MON + `<month>:<session id>:<startedAt>`, MBASE its starting cost.
const MON = 'mon:'
const MBASE = 'mbase:'
const SINCE = 'since'
const LEDGER = 'ledger'
const SPEND = 'spend:'
const LIMITS = 'limits'
const SETTINGS = 'settings'

const PANE = 'rings-settings'
const MUTED = '#9a9a9a'
const PHASES = ['○', '◔', '◑', '◕', '●']
const HOUR = 3_600_000

// An installed release loads from the plugin cache; anything else (a dev-mods folder,
// --plugin-dir, a test) is a working copy, tagged "dev" on the band.
const isDevRoot = (root: string) => !root.replace(/\\/g, '/').includes('/plugins/cache/')
const WINDOWS: Record<string, number> = { five_hour: 5 * HOUR, seven_day: 7 * 24 * HOUR }

type Palette = Record<Slot, string>
type Gauge = {
  key: string
  label: string
  percent?: number
  reset?: string
  // Share of the window already past, 0-100; absent for context and windows of unknown length.
  elapsed?: number
  // Time until 100% at the window's average rate so far, when that comes before the reset.
  fullIn?: string
  // Whether the window has a long enough history for a forecast.
  canForecast: boolean
  // Context's token count, `380k / 1M`.
  note?: string
}
// One line of text on a tile; `color` marks the value that leads it.
type Figure = { key: string; text: string; color?: string; isDim?: boolean; label?: string }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const money = (usd: number) => `$${usd.toFixed(2)}`
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)

const span = (ms: number) => {
  const mins = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
}

const tokens = (n: number) =>
  n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`

const isLedger = (v: unknown): v is Ledger =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Ledger).day === 'string' &&
  typeof (v as Ledger).dayUsd === 'number' &&
  typeof (v as Ledger).month === 'string' &&
  typeof (v as Ledger).monthUsd === 'number'

const isLimitList = (v: unknown): v is Limit[] =>
  Array.isArray(v) && v.every(l => typeof l?.kind === 'string' && typeof l?.percentUsed === 'number')

// Settings come from storage another version may have written: keep what is valid, default the rest.
const toSettings = (v: unknown): RingSettings => {
  const raw = (typeof v === 'object' && v !== null ? v : {}) as Partial<RingSettings>
  const parts = { ...DEFAULTS.parts }
  for (const id of PART_IDS) {
    const on = raw.parts?.[id]
    if (typeof on === 'boolean') parts[id] = on
  }
  const colors: RingSettings['colors'] = {}
  for (const slot of SLOTS) {
    const c = raw.colors?.[slot]
    if (isHex(c)) colors[slot] = c
  }
  return {
    mode: raw.mode === 'minimal' ? 'minimal' : 'tiles',
    lang: raw.lang === 'zh' ? 'zh' : 'en',
    parts,
    preset: raw.preset && raw.preset in PRESETS ? raw.preset : 'default',
    colors,
    scope: raw.scope === 'session' ? 'session' : 'all',
    startShown: {
      desktop: typeof raw.startShown?.desktop === 'boolean' ? raw.startShown.desktop : DEFAULTS.startShown.desktop,
      terminal: typeof raw.startShown?.terminal === 'boolean' ? raw.startShown.terminal : DEFAULTS.startShown.terminal,
    },
  }
}

const paletteOf = (s: RingSettings): Palette => ({ ...PRESETS[s.preset], ...s.colors })

const toSnapshot = (u: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'> & { startedAt?: number }): Snapshot => ({
  contextPercent: u.context.percent,
  contextTokens: u.context.tokens,
  contextWindow: u.context.window,
  limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  sessionUsd: u.cost?.usd,
  startedAt: u.startedAt,
})

// five_hour and seven_day are the plan windows; a per-model weekly window (e.g.
// seven_day_<model>) shows under the model's name.
const describe = (kind: string, w: Words): { label: string; part: Part } => {
  if (kind === 'five_hour') return { label: '5h', part: '5h' }
  if (kind === 'seven_day') return { label: '7d', part: '7d' }
  if (kind === 'spend_limit') return { label: w.spendLimit, part: 'models' }
  const name = kind.replace(/^seven_day_/, '').replace(/_/g, ' ')
  return { label: name.charAt(0).toUpperCase() + name.slice(1), part: 'models' }
}
const windowOf = (kind: string) => WINDOWS[kind] ?? (kind.startsWith('seven_day_') ? WINDOWS.seven_day : undefined)

const toGauge = (l: Limit, t: number, w: Words): Gauge => {
  const { label } = describe(l.kind, w)
  const resetsAt = l.resetsAt ? Date.parse(l.resetsAt) : undefined
  // A window whose reset time has passed starts over until fresh data arrives.
  if (resetsAt !== undefined && resetsAt <= t) return { key: l.kind, label, percent: 0, canForecast: false }

  const length = windowOf(l.kind)
  const left = resetsAt === undefined ? undefined : resetsAt - t
  const past = length === undefined || left === undefined ? undefined : clamp(length - left, 0, length)
  const gauge: Gauge = {
    key: l.kind,
    label,
    percent: l.percentUsed,
    reset: left === undefined ? undefined : span(left),
    elapsed: past === undefined || length === undefined ? undefined : (past / length) * 100,
    canForecast: past !== undefined && length !== undefined && past >= length * 0.05,
  }
  if (gauge.canForecast && past && left !== undefined && l.percentUsed > 0 && l.percentUsed < 100) {
    const toFull = ((100 - l.percentUsed) * past) / l.percentUsed
    if (toFull < left) gauge.fullIn = span(toFull)
  }
  return gauge
}

// A ring gauge: faint track, an arc from 12 o'clock in the level's color, the percentage inside,
// and an optional tick across the ring where the window's time has got to.
// Drawn as a plain image, so the markup holds only what the ring shows: the tick moves in whole
// percents and nothing else changes with the clock, so redraws mostly hand the same image back.
const ring = (percent: number | undefined, color: string, palette: Palette, elapsed?: number) => {
  const r = 14
  const c = 2 * Math.PI * r
  const p = clamp(percent ?? 0, 0, 100)
  const arc =
    p > 0
      ? `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" ` +
        `stroke-dasharray="${((c * p) / 100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 18 18)"/>`
      : ''
  let tick = ''
  if (elapsed !== undefined) {
    const a = (Math.round(clamp(elapsed, 0, 100)) / 100) * 2 * Math.PI - Math.PI / 2
    const x = (d: number) => (18 + d * Math.cos(a)).toFixed(2)
    const y = (d: number) => (18 + d * Math.sin(a)).toFixed(2)
    tick = `<line x1="${x(10.2)}" y1="${y(10.2)}" x2="${x(17.8)}" y2="${y(17.8)}" stroke="${palette.pace}" stroke-width="1.8" stroke-linecap="round"/>`
  }
  const label = percent === undefined ? '–' : `${Math.round(percent)}%`
  const size = label.length >= 4 ? 8.6 : 10
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">` +
    `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${palette.track}" stroke-opacity="0.3" stroke-width="3.5"/>` +
    arc +
    tick +
    `<text x="18" y="${(18 + size * 0.36).toFixed(2)}" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif" ` +
    `font-size="${size}" font-weight="650" fill="${color}">${label}</text>` +
    `</svg>`
  )
}

// The dev build's tag: an image, so it keeps this small size whatever the host's box spacing.
const devTag = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="16" viewBox="0 0 30 16">` +
  `<rect x="0.5" y="0.5" width="29" height="15" rx="4" fill="none" stroke="${color}"/>` +
  `<text x="15" y="11.3" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif" ` +
  `font-size="10" font-weight="600" fill="${color}">dev</text>` +
  `</svg>`

const swatch = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><rect width="14" height="14" rx="3" fill="${color}"/></svg>`

async function account($: EngineInterface, usd: number | undefined) {
  if (usd === undefined) return
  const seen = await read($, seenUsd)
  await update($, seenUsd, () => usd)

  const day = dayKey(await $.clock.now())
  const startedAt = (await read($, snapshot))?.startedAt
  const began = startedAt === undefined ? undefined : dayKey(startedAt)
  const session = `${await $.session.id()}:${startedAt ?? 0}`
  // A session begun within the day (or month) counts from its first message, whenever the mod
  // loaded. One begun earlier counts from what it had cost when that period began here.
  const record = async (figure: string, baseKey: string, isWhole: boolean) => {
    let base = 0
    if (!isWhole) {
      const kept = await $.store.get(baseKey)
      if (typeof kept === 'number') base = kept
      else {
        base = Math.min(seen ?? usd, usd)
        await $.store.set(baseKey, base)
      }
    }
    const spent = Math.max(0, usd - base)
    if ((await $.store.get(figure)) !== spent) await $.store.set(figure, spent)
  }
  await record(`${USD}${day}:${session}`, `${BASE}${day}:${session}`, began === day)
  const month = day.slice(0, 7)
  await record(`${MON}${month}:${session}`, `${MBASE}${month}:${session}`, began?.slice(0, 7) === month)
  await refreshLedger($)
}

// The period a store key's figure belongs to, from `<prefix><YYYY-MM-DD>...` or `<prefix><YYYY-MM>...`.
const dayOf = (key: string, prefix: string) => key.slice(prefix.length, prefix.length + 10)
const monthOf = (key: string, prefix: string) => key.slice(prefix.length, prefix.length + 7)

// Today's and this month's totals, for every session and for this one: each session's figures
// summed, plus the older ledgers' figures for days before this scheme ran.
async function refreshLedger($: EngineInterface) {
  const day = dayKey(await $.clock.now())
  const month = day.slice(0, 7)
  const kept = await $.store.get(SINCE)
  const since = typeof kept === 'string' ? kept : day
  const mine = `${await $.session.id()}:${(await read($, snapshot))?.startedAt ?? 0}`
  let dayUsd = 0
  let monthUsd = 0
  let ownDay = 0
  let ownMonth = 0
  // A session with no month figure yet (one 0.3.2 or 0.4.0 recorded) counts its days instead.
  const daysOf = new Map<string, number>()
  const withMonth = new Set<string>()
  for (const key of await $.store.keys()) {
    const usd = await $.store.get(key)
    if (typeof usd !== 'number') continue
    if (key.startsWith(USD) && monthOf(key, USD) === month) {
      const session = key.slice(USD.length + 11)
      daysOf.set(session, (daysOf.get(session) ?? 0) + usd)
      if (dayOf(key, USD) === day) {
        dayUsd += usd
        if (session === mine) ownDay += usd
      }
    } else if (key.startsWith(MON) && monthOf(key, MON) === month) {
      const session = key.slice(MON.length + 8)
      withMonth.add(session)
      monthUsd += usd
      if (session === mine) ownMonth += usd
    } else if (key.startsWith(SPEND) && monthOf(key, SPEND) === month && dayOf(key, SPEND) < since) {
      monthUsd += usd
      if (dayOf(key, SPEND) === day) dayUsd += usd
    }
  }
  for (const [session, usd] of daysOf) {
    if (withMonth.has(session)) continue
    monthUsd += usd
    if (session === mine) ownMonth += usd
  }
  const legacy = await $.store.get(LEDGER)
  if (isLedger(legacy) && legacy.month === month) {
    const isOlder = legacy.day < since
    monthUsd += legacy.monthUsd - (isOlder ? 0 : legacy.dayUsd)
    if (isOlder && legacy.day === day) dayUsd += legacy.dayUsd
  }
  // A write redraws the band: skip it when the cents shown would not change.
  const cents = (v: number) => Math.round(v * 100)
  const same = (l: Ledger | null, d: number, m: number) =>
    l !== null && l.day === day && cents(l.dayUsd) === cents(d) && cents(l.monthUsd) === cents(m)
  await update($, ledger, l => (same(l, dayUsd, monthUsd) ? l : { day, month, dayUsd, monthUsd }))
  await update($, own, l => (same(l, ownDay, ownMonth) ? l : { day, month, dayUsd: ownDay, monthUsd: ownMonth }))
}

// Drops figures from months before this one, and marks the day this scheme first ran.
async function pruneLedger($: EngineInterface) {
  const day = dayKey(await $.clock.now())
  const month = day.slice(0, 7)
  if (typeof (await $.store.get(SINCE)) !== 'string') await $.store.set(SINCE, day)
  for (const key of await $.store.keys()) {
    const prefix = [USD, BASE, MON, MBASE, SPEND].find(p => key.startsWith(p))
    if (prefix && monthOf(key, prefix) !== month) await $.store.delete(key)
  }
  const legacy = await $.store.get(LEDGER)
  if (legacy !== undefined && !(isLedger(legacy) && legacy.month === month)) await $.store.delete(LEDGER)
}

async function change($: EngineInterface, edit: (s: RingSettings) => RingSettings) {
  const next = await update($, settings, s => toSettings(edit(s)))
  await $.store.set(SETTINGS, next)
  return next
}

// Rough tokens for text as it streams: about four characters a token, one per CJK character.
const roughTokens = (text: string) => {
  const wide = (text.match(/[　-鿿가-힯＀-￯]/g) ?? []).length
  return wide + (text.length - wide) / 4
}

async function runCommand($: EngineInterface, args: string): Promise<string> {
  const [verb = '', ...rest] = args.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const w = TEXT[(await read($, settings)).lang]
  if (verb === '') {
    const hidden = await update($, isHidden, h => !(h ?? false))
    return hidden ? w.hidden : w.shown
  }
  if (verb === 'default') {
    const [where, value] = rest
    const s = await read($, settings)
    if (!START_SURFACES.includes(where as StartSurface) || (value !== 'on' && value !== 'off'))
      return w.defaultHelp(START_SURFACES.map(x => w.defaultNow(w.surfaces[x], s.startShown[x])).join(', '))
    const surface = where as StartSurface
    await change($, x => ({ ...x, startShown: { ...x.startShown, [surface]: value === 'on' } }))
    return w.defaultSet(w.surfaces[surface], value === 'on')
  }
  if (verb === 'settings') {
    const opened = await $.ui.open({ id: PANE, title: w.paneTitle, focus: true })
    return opened.isPlaced ? w.opened : w.notOpened(String(opened.reason))
  }
  if (verb === 'mode') {
    const mode = rest[0]
    if (mode !== 'tiles' && mode !== 'minimal') return w.modeHelp
    await change($, s => ({ ...s, mode }))
    return w.modeSet(mode)
  }
  if (verb === 'lang') {
    const lang = rest[0]
    if (lang !== 'en' && lang !== 'zh') return w.langHelp
    await change($, s => ({ ...s, lang }))
    return TEXT[lang].langSet
  }
  if (verb === 'scope') {
    const scope = rest[0]
    if (scope !== 'all' && scope !== 'session') return w.scopeHelp
    await change($, s => ({ ...s, scope }))
    return w.scopeSet(scope)
  }
  if (verb === 'show' || verb === 'hide') {
    const ids = rest.includes('all') ? PART_IDS : rest
    const known = ids.filter((id): id is Part => PART_IDS.includes(id as Part))
    const unknown = ids.filter(id => !known.includes(id as Part))
    if (known.length === 0) return w.partsHelp(PART_IDS.join(', '))
    await change($, s => ({ ...s, parts: { ...s.parts, ...Object.fromEntries(known.map(id => [id, verb === 'show'])) } }))
    return w.partsSet(verb === 'show', known.join(', '), unknown.join(', '))
  }
  if (verb === 'theme') {
    const name = rest[0]
    if (!name || !(name in PRESETS)) return w.themeHelp(Object.keys(PRESETS).join(', '))
    await change($, s => ({ ...s, preset: name as Preset }))
    return w.themeSet(name)
  }
  if (verb === 'color') {
    const [slot, value] = rest
    if (!SLOTS.includes(slot as Slot)) return w.slotHelp(SLOTS.join(', '))
    if (value === 'reset') {
      await change($, s => {
        const colors = { ...s.colors }
        delete colors[slot as Slot]
        return { ...s, colors }
      })
      return w.colorReset(String(slot))
    }
    if (!isHex(value)) return w.colorBad
    await change($, s => ({ ...s, colors: { ...s.colors, [slot as Slot]: value } }))
    return w.colorSet(String(slot), value)
  }
  if (verb === 'reset') {
    // The language stays: resetting the look should not switch what the band speaks.
    await change($, s => ({ ...DEFAULTS, lang: s.lang }))
    return w.resetDone
  }
  return w.help(PART_IDS.join(', '), Object.keys(PRESETS).join(', '), SLOTS.join(', '))
}

export const register: Register = on => {
  let tick: Timer | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'rings',
      description: 'Hide or show the usage rings in this session; /rings settings to configure them',
      argumentHint: '[settings | mode | lang | scope | show | hide | theme | color | default | reset]',
    })

    const usage = await $.session.usage()
    const snap = toSnapshot(usage)
    // A fresh session has no rate-limit reading until its first response: show the last one saved.
    if (snap.limits.length === 0) {
      const saved = await $.store.get(LIMITS)
      if (isLimitList(saved)) snap.limits = saved
    }
    await update($, snapshot, () => snap)

    // What it had cost when the mod first saw it: where a session begun on an earlier day counts from.
    if ((await read($, seenUsd)) === null && usage.cost) {
      const usd = usage.cost.usd
      await update($, seenUsd, () => usd)
    }
    await pruneLedger($)
    await account($, usage.cost?.usd)
    await refreshLedger($)
    const stored = toSettings(await $.store.get(SETTINGS))
    await update($, settings, () => stored)
    // Each surface has its own default; a reload keeps what this session already chose.
    const where: StartSurface = e.surface === 'terminal' ? 'terminal' : 'desktop'
    await update($, isHidden, h => h ?? !stored.startShown[where])

    // Once a minute: redraw so the reset countdowns stay current, and pick up other sessions' spend.
    tick?.cancel()
    tick = $.clock.every(60_000, () => {
      void update($, minute, n => n + 1)
      void refreshLedger($)
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const prev = await read($, snapshot)
    const snap = { ...toSnapshot(e), startedAt: prev?.startedAt }
    if (snap.limits.length > 0) await $.store.set(LIMITS, snap.limits)
    else snap.limits = prev?.limits ?? []
    await update($, snapshot, () => snap)
    await account($, e.cost?.usd)
    const usd = e.cost?.usd
    if (usd !== undefined) await update($, turn, t => ({ startUsd: t.startUsd ?? usd, usd }))

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const usd = (await read($, snapshot))?.sessionUsd ?? null
    await update($, turn, () => ({ startUsd: usd, usd }))
    return next(e)
  })

  // Watches the main loop's responses stream by, passing every piece on untouched, to time them.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)

    const sentAt = await $.clock.now()
    let firstAt: number | undefined
    let count = 0
    let shownAt = 0
    let shown: number | undefined
    try {
      for await (const chunk of next(e)) {
        yield chunk
        const now = await $.clock.now()
        if (firstAt === undefined) {
          firstAt = now
          const ttftMs = now - sentAt
          // The last response's speed stays up until this one has a reading of its own.
          await update($, stream, s => ({ ...s, isStreaming: true, live: undefined, ttftMs }))
        }
        if (chunk.kind === 'text' || chunk.kind === 'thinking') count += roughTokens(chunk.text)
        else if (chunk.kind === 'input') count += roughTokens(chunk.json)
        else if (chunk.kind === 'stop') {
          const u = chunk.usage
          const secs = (now - firstAt) / 1000
          const cached = u ? u.cache_read_input_tokens : 0
          const total = u ? u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens : 0
          await update($, stream, s => ({
            ...s,
            isStreaming: false,
            live: undefined,
            last: u && secs > 0.2 ? u.output_tokens / secs : s.last,
            cacheHit: total > 0 ? (cached / total) * 100 : s.cacheHit,
          }))
          continue
        }
        // Once a second at most, and only when the figure drawn would change: each write redraws the band.
        if (now - shownAt >= 1000 && now - firstAt > 200) {
          shownAt = now
          const live = count / ((now - firstAt) / 1000)
          if (Math.round(live) !== shown) {
            shown = Math.round(live)
            await update($, stream, s => ({ ...s, live }))
          }
        }
      }
    } finally {
      await update($, stream, s => (s.isStreaming ? { ...s, isStreaming: false, live: undefined } : s))
    }
  })

  on('command.run', { command: 'rings' }, async ($, e) => ({ text: await runCommand($, e.args) }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = await read($, settings)
    const w = TEXT[s.lang]
    const palette = paletteOf(s)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined
    const Select = 'Select' in ui ? ui.Select : undefined
    const Input = 'Input' in ui ? ui.Input : undefined

    return (
      <Box flexDirection="column" gap={1}>
        {Select ? (
          <Box flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={1}>
            <Select
              key="mode"
              label={w.layout}
              value={s.mode}
              options={(['tiles', 'minimal'] as const).map(m => ({ value: m, label: w.modes[m] }))}
              onSelect={v => void change($, x => ({ ...x, mode: v === 'minimal' ? 'minimal' : 'tiles' }))}
            />
            <Select
              key="theme"
              label={w.theme}
              value={s.preset}
              options={Object.keys(PRESETS).map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
              onSelect={v => void change($, x => ({ ...x, preset: v as Preset }))}
            />
            <Select
              key="lang"
              label={w.language}
              value={s.lang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'zh', label: '中文' },
              ]}
              onSelect={v => void change($, x => ({ ...x, lang: v === 'zh' ? 'zh' : 'en' }))}
            />
            <Select
              key="scope"
              label={w.scope}
              value={s.scope}
              options={(['all', 'session'] as const).map(x => ({ value: x, label: w.scopes[x] }))}
              onSelect={v => void change($, x => ({ ...x, scope: v === 'session' ? 'session' : 'all' }))}
            />
          </Box>
        ) : (
          <Text dimColor>
            {w.layout} {w.modes[s.mode]} · {w.theme} {s.preset} · {w.language} {s.lang} · {w.scope} {w.scopes[s.scope]}
          </Text>
        )}
        <Text weight="semibold">{w.show}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {PART_IDS.map(id => (
            <Button
              key={`part-${id}`}
              label={`${s.parts[id] ? '✓' : '○'} ${w.parts[id]}`}
              dimColor={!s.parts[id]}
              onPress={() => void change($, x => ({ ...x, parts: { ...x.parts, [id]: !x.parts[id] } }))}
            />
          ))}
        </Box>
        <Text weight="semibold">{w.startTitle}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {START_SURFACES.map(x => (
            <Button
              key={`start-${x}`}
              label={`${s.startShown[x] ? '✓' : '○'} ${w.surfaces[x]}`}
              dimColor={!s.startShown[x]}
              onPress={() => void change($, v => ({ ...v, startShown: { ...v.startShown, [x]: !v.startShown[x] } }))}
            />
          ))}
        </Box>
        <Text weight="semibold">{w.colors}</Text>
        <Box flexDirection="column" gap={1}>
          {SLOTS.map(slot => (
            <Box key={`slot-${slot}`} flexDirection="row" gap={1} alignItems="center">
              {Svg ? (
                <Svg source={swatch(palette[slot])} alt={`${w.slots[slot]} ${palette[slot]}`} width={14} height={14} />
              ) : null}
              {Input ? (
                <Input
                  key={`color-${slot}`}
                  label={w.slots[slot]}
                  value={s.colors[slot] ?? ''}
                  placeholder={PRESETS[s.preset][slot]}
                  submitLabel={w.set}
                  onSubmit={v => {
                    const value = v.trim()
                    if (value !== '' && !isHex(value)) return
                    void change($, x => {
                      const colors = { ...x.colors }
                      if (value === '') delete colors[slot]
                      else colors[slot] = value
                      return { ...x, colors }
                    })
                  }}
                />
              ) : (
                <Text color={palette[slot]}>
                  {w.slots[slot]} {palette[slot]}
                </Text>
              )}
            </Box>
          ))}
        </Box>
        <Text dimColor>{w.colorHint}</Text>
        <Box flexDirection="row" gap={1}>
          <Button
            key="reset"
            label={w.resetAll}
            dimColor
            onPress={() => void change($, x => ({ ...DEFAULTS, lang: x.lang }))}
          />
          <Button key="close" label={w.done} variant="primary" role="dismiss" onPress={() => void $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null || (await read($, isHidden)) === true) return next(e)

    await read($, minute)
    const t = await $.clock.now()
    const s = await read($, settings)
    const w = TEXT[s.lang]
    const show = s.parts
    const palette = paletteOf(s)
    const isMinimal = s.mode === 'minimal'

    const ctxTokens =
      snap.contextTokens ??
      (snap.contextPercent === undefined ? undefined : Math.round((snap.contextPercent / 100) * snap.contextWindow))
    const gauges: Gauge[] = [
      ...(show.ctx
        ? [
            {
              key: 'ctx',
              label: w.ctx,
              percent: snap.contextPercent,
              canForecast: false,
              note: ctxTokens === undefined ? undefined : `${tokens(ctxTokens)} / ${tokens(snap.contextWindow)}`,
            },
          ]
        : []),
      ...snap.limits.filter(l => show[describe(l.kind, w).part]).map(l => toGauge(l, t, w)),
    ]

    // A window set to run out before it resets reads as a warning even at a low level.
    const colorOf = (g: Gauge) => {
      if (g.percent === undefined) return MUTED
      const level = g.percent < 60 ? palette.ok : g.percent < 85 ? palette.warn : palette.danger
      return level === palette.ok && show.forecast && g.fullIn ? palette.warn : level
    }
    const pctText = (g: Gauge) => (g.percent === undefined ? '–' : `${Math.round(g.percent)}%`)
    const titleOf = (g: Gauge) =>
      [
        w.used(g.label, pctText(g)),
        g.note,
        g.reset && w.resetsIn(g.reset),
        g.elapsed !== undefined && w.gone(Math.round(g.elapsed)),
        g.fullIn ? w.full(g.fullIn) : g.canForecast ? w.lasts : undefined,
      ]
        .filter(Boolean)
        .join(' · ')
    // A tile's second line: the forecast when the window is set to run out, else the reset time.
    const secondLine = (g: Gauge): Figure | undefined => {
      if (show.forecast && g.fullIn) return { key: `${g.key}-2`, text: w.full(g.fullIn), color: palette.warn }
      if (show.resets && g.reset) return { key: `${g.key}-2`, text: g.reset, isDim: true }
      if (g.note) return { key: `${g.key}-2`, text: g.note, isDim: true }
      return undefined
    }

    // Spend and speed, each a tile: its first figure leads, the rest share the second line.
    const book = await read($, ledger)
    const flow = await read($, stream)
    const spent = await read($, turn)
    const today = dayKey(t)
    const sessionUsd = snap.sessionUsd ?? 0
    const hours = snap.startedAt === undefined ? 0 : (t - snap.startedAt) / HOUR
    const spend: Figure[] = []
    if (show.session)
      spend.push({ key: 'session', text: money(sessionUsd), color: palette.accent, label: w.sessionLabel })
    // Today and month, for every session or this one, from the same per-session figures.
    const totalsOf = s.scope === 'all' ? book : await read($, own)
    const dayUsd = totalsOf?.day === today ? totalsOf.dayUsd : 0
    const monthUsd = totalsOf?.month === today.slice(0, 7) ? totalsOf.monthUsd : 0
    const totals = [show.day ? w.today(money(dayUsd)) : '', show.month ? w.month(money(monthUsd)) : ''].filter(Boolean)
    if (totals.length > 0) spend.push({ key: 'totals', text: w.totals(s.scope, totals.join(' · ')) })
    if (show.turn && spent.usd !== null && spent.startUsd !== null)
      spend.push({ key: 'turn', text: w.turn(money(Math.max(0, spent.usd - spent.startUsd))) })
    if (show.rate && hours > 1 / 60) spend.push({ key: 'rate', text: w.rate(money(sessionUsd / hours)) })

    const speedNow = flow.isStreaming ? (flow.live ?? flow.last) : flow.last
    const speed: Figure[] = []
    if (show.speed && speedNow !== undefined)
      speed.push({ key: 'speed', text: `${flow.isStreaming && flow.live !== undefined ? '~' : ''}${Math.round(speedNow)} tok/s` })
    if (show.cache && flow.cacheHit !== undefined) speed.push({ key: 'cache', text: w.cache(Math.round(flow.cacheHit)) })
    if (show.ttft && flow.ttftMs !== undefined) speed.push({ key: 'ttft', text: w.ttft((flow.ttftMs / 1000).toFixed(1)) })
    const cards = [spend, speed].filter(c => c.length > 0)

    if (gauges.length === 0 && cards.length === 0) return next(e)

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const isDev = isDevRoot($.plugin.root)

    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      const size = isMinimal ? 28 : 32
      const band = (
        <Box flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={1} alignItems="center" flexGrow={1} flexShrink={1}>
          {gauges.map(g => {
            const below = secondLine(g)
            const svg = (
              <Svg
                source={ring(g.percent, colorOf(g), palette, show.pace ? g.elapsed : undefined)}
                alt={titleOf(g)}
                width={size}
                height={size}
              />
            )
            if (isMinimal) return <Box key={g.key}>{svg}</Box>
            return (
              <Box key={g.key} flexDirection="row" gap={1} alignItems="center">
                {svg}
                <Box flexDirection="column">
                  <Text weight="semibold">{g.label}</Text>
                  {below ? (
                    <Text size="footnote" color={below.color} dimColor={below.isDim} tabular>
                      {below.text}
                    </Text>
                  ) : null}
                </Box>
              </Box>
            )
          })}
          {cards.map(([lead, ...rest]) =>
            lead === undefined ? null : (
              <Box key={`card-${lead.key}`} flexDirection="column">
                {lead.label && !isMinimal ? (
                  <Box flexDirection="row" gap={1}>
                    <Text weight="semibold" color={lead.color} tabular>
                      {lead.text}
                    </Text>
                    <Text dimColor>{lead.label}</Text>
                  </Box>
                ) : (
                  <Text weight="semibold" color={lead.color} tabular>
                    {lead.text}
                  </Text>
                )}
                {!isMinimal && rest.length > 0 ? (
                  <Text size="footnote" dimColor tabular>
                    {rest.map(f => f.text).join(' · ')}
                  </Text>
                ) : null}
              </Box>
            ),
          )}
        </Box>
      )
      if (!isDev) return band
      return (
        <Box flexDirection="row" alignItems="flex-start" justifyContent="space-between" width="100%" gap={1}>
          {band}
          <Box key="dev" flexShrink={0} alignSelf="flex-start">
            <Svg source={devTag(palette.warn)} alt="dev" width={30} height={16} />
          </Box>
        </Box>
      )
    }

    // Terminal: no vector element, so a quarter-step circle glyph stands in for each ring,
    // and an arrow for the pace tick: up when usage runs ahead of the time gone by.
    const glyph = (p: number) => PHASES[Math.min(4, Math.round(clamp(p, 0, 100) / 25))]
    const gaugeText = gauges.map(g => {
      const head = g.percent === undefined ? `○ –` : `${glyph(g.percent)} ${Math.round(g.percent)}%`
      const pace =
        show.pace && g.elapsed !== undefined && g.percent !== undefined ? (g.percent > g.elapsed ? ' ▲' : ' ▽') : ''
      const below = isMinimal ? undefined : secondLine(g)
      return `${head}${pace} ${g.label}${below ? ` ${below.text}` : ''}`
    })
    const cardText = cards.map(c =>
      (isMinimal ? c.slice(0, 1) : c).map(f => (f.label && !isMinimal ? `${f.text} ${f.label}` : f.text)).join(' · '),
    )
    return (
      <Box flexDirection="row" gap={2}>
        <Box flexGrow={1} flexShrink={1}>
          <Text dimColor>{[...gaugeText, ...cardText].join('   ')}</Text>
        </Box>
        {isDev ? <Text color={palette.warn}>dev</Text> : null}
      </Box>
    )
  })
}
