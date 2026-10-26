import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const NOW = Date.parse('2026-10-26T10:00:00Z')
const inMinutes = (m: number) => new Date(NOW + m * 60000).toISOString()

// 5h: 38m of the window gone at 60% used, so it runs out in ~25m, before the reset.
const LIMITS = [
  { kind: 'five_hour', percentUsed: 60, resetsAt: inMinutes(4 * 60 + 22) },
  { kind: 'seven_day', percentUsed: 25, resetsAt: inMinutes((4 * 24 + 17) * 60) },
  { kind: 'seven_day_fable', percentUsed: 0, resetsAt: inMinutes((4 * 24 + 17) * 60) },
]

const BAND = {
  plugin: 'usage-rings',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 200,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const rings = (args: string) => ({
  command: 'rings',
  args,
  origin: { kind: 'composer' } as const,
  presentation: { isFullscreen: false, columns: 120 },
})

const PANE = {
  plugin: 'usage-rings',
  component: 'Pane',
  requestId: 'rings-settings',
  props: {
    title: 'Usage rings',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// The color of the innermost Text holding exactly these words.
const colorOf = async (ui: { findAll: (q: { type: string; text: string }) => Promise<{ props: Record<string, unknown> }[]> }, text: string) =>
  (await ui.findAll({ type: 'Text', text })).map(t => t.props.color).find(c => c !== undefined)

// The local calendar day, as the mod keys spend.
const DAY = (() => {
  const d = new Date(NOW)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

async function start(...[$, on, surface = 'desktop']: [...Parameters<TestBody>, ('desktop' | 'terminal')?]) {
  mock.clock(on, { now: NOW })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }))
  on('command.register', () => ({ value: { command: 'rings' } }))
  on('session.usage', () => ({
    value: { startedAt: NOW - 2 * 3_600_000, context: { window: 1000000 }, rateLimits: [], cost: { usd: 2 } },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface, isInteractive: true })
  await $.session.measure({
    context: { window: 1000000, tokens: 380000, percent: 38 },
    rateLimits: LIMITS,
    cost: { usd: 15.24 },
    changed: ['context', 'rateLimits', 'cost'],
  })
}

const svgOf = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }, label: string) =>
  String((await ui.findAll({ type: 'Svg' })).find(r => String(r.props.alt).startsWith(label))?.props.source)

// The ring images, leaving out the dev build's tag.
const ringCount = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Svg' })).filter(r => r.props.alt !== 'dev').length

test('tiles: rings with the percentage inside, a second line each, spend and speed cards', async ($, on) => {
  await start($, on)

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  for (const words of ['ctx', '380k / 1M', '5h', 'full ~25m', '7d', '4d17h', 'Fable', '$15.24', 'all: today $15.24 · mo $15.24']) {
    expect((await desktop.find({ type: 'Text', text: words }))?.text).toBe(words)
  }
  expect(await colorOf(desktop, '$15.24')).toBe('#22c55e')
  // The session's own total says so; today and month are every session's.
  expect((await desktop.find({ type: 'Text', text: 'session' }))?.text).toBe('session')
  expect(await colorOf(desktop, 'full ~25m')).toBe('#f59e0b')
  // 5h runs out before its reset: amber ring, its percentage inside, a tick where the time is.
  const fiveHour = await svgOf(desktop, '5h')
  expect(fiveHour).toContain('60%</text>')
  expect(fiveHour).toContain('stroke="#f59e0b"')
  expect(fiveHour).toContain('<line')
  // A plain image: no tooltip, and nothing in it that moves with the clock.
  expect(fiveHour).not.toContain('<title>')
  expect(String((await desktop.findAll({ type: 'Svg' }))[0]?.props.isInteractive)).toBe('undefined')
  expect(await svgOf(desktop, 'ctx')).not.toContain('<line')
  expect(await desktop.find({ type: 'Text', text: /cache|ttft/ })).toBe(undefined)
  // Loaded from a working copy, not the plugin cache: tagged as the dev build.
  expect(await svgOf(desktop, 'dev')).toContain('stroke="#f59e0b"')
  await desktop.unmount()

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const line = (await terminal.find({ type: 'Text', text: /ctx/ }))?.text ?? ''
  expect(line).toContain('◑ 38% ctx 380k / 1M')
  expect(line).toContain('◑ 60% ▲ 5h full ~25m')
  expect(line).toContain('◔ 25% ▽ 7d 4d17h')
  expect(line).toContain('$15.24 session · all: today $15.24 · mo $15.24')
  await terminal.unmount()
})

test('/rings switches the language, the parts, the colors and the layout', async ($, on) => {
  await start($, on)

  for (const args of ['lang zh', 'hide day ctx', 'color accent #ff0000', 'theme ocean']) {
    await $.command.run(rings(args))
  }
  expect((await $.command.run(rings('color ok red'))).text).toContain('#rgb')

  const zh = await $.ui.mount({ ...BAND, surface: 'desktop' })
  for (const words of ['约 25m 用满', '全部：本月 $15.24']) {
    expect((await zh.find({ type: 'Text', text: words }))?.text).toBe(words)
  }
  expect(await zh.find({ type: 'Text', text: /上下文|今日/ })).toBe(undefined)
  expect(await colorOf(zh, '$15.24')).toBe('#ff0000')
  // The 5h ring takes the ocean theme's warning color.
  expect(await svgOf(zh, '5h')).toContain('#fbbf24')
  await zh.unmount()

  await $.command.run(rings('mode minimal'))
  const minimal = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ringCount(minimal)).toBe(3)
  expect(await minimal.find({ type: 'Text', text: /5h|用满|本月/ })).toBe(undefined)
  expect((await minimal.find({ type: 'Text', text: '$15.24' }))?.text).toBe('$15.24')
  await minimal.unmount()

  // A reset restores the look but keeps the language.
  await $.command.run(rings('reset'))
  const back = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await back.find({ type: 'Text', text: '上下文' }))?.text).toBe('上下文')
  await back.unmount()
})

test('the settings pane toggles parts and picks the layout and language', async ($, on) => {
  await start($, on)

  for (const surface of ['terminal', 'desktop'] as const) {
    await $.command.run(rings('reset'))
    const pane = await $.ui.mount({ ...PANE, surface })
    await pane.press({ key: 'part-ctx' })
    await pane.select({ key: 'mode', value: 'minimal' })
    await pane.select({ key: 'lang', value: 'zh' })
    expect((await pane.find({ type: 'Button', text: /上下文/ }))?.text).toBe('○ 上下文')
    await pane.unmount()

    const band = await $.ui.mount({ ...BAND, surface })
    expect(await band.find({ type: 'Text', text: /上下文|用满/ })).toBe(undefined)
    if (surface === 'terminal') expect((await band.find({ type: 'Text', text: /5h/ }))?.text).toContain('◑ 60% ▲ 5h')
    else expect(await ringCount(band)).toBe(3)
    await band.unmount()
  }
})

test('the band shows the speed and cache hits of the last response', async ($, on) => {
  const usage = {
    model: 'm',
    input_tokens: 100,
    output_tokens: 120,
    cache_read_input_tokens: 800,
    cache_creation_input_tokens: 100,
  }
  on('turn.step', async function* () {
    yield { kind: 'text', index: 0, text: 'hello there' }
    yield { kind: 'stop', stopReason: 'end_turn', usage }
    return { turnId: 't', index: 0, answer: 'hello there', toolUses: [], stopReason: 'end_turn', usage }
  })
  await start($, on)
  await $.command.run(rings('show cache ttft'))
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 })) {
    // drain
  }

  // The mocked clock stands still, so no speed: cache hits lead the card.
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ type: 'Text', text: '80% cache' }))?.text).toBe('80% cache')
  expect((await band.find({ type: 'Text', text: 'ttft 0.0s' }))?.text).toBe('ttft 0.0s')
  await band.unmount()
})

test('a terminal session starts with the band hidden, and /rings default changes that', async ($, on) => {
  // Beneath the plugin: the band hook falls through to these when it draws nothing.
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  on('ui.toast', () => ({ value: undefined }))
  await start($, on, 'terminal')

  const hidden = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await hidden.find({ type: 'Text', text: /ctx/ })).toBe(undefined)
  await hidden.unmount()

  expect((await $.command.run(rings(''))).text).toContain('shown')
  const shown = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await shown.find({ type: 'Text', text: /ctx/ }))?.text).toContain('38% ctx')
  await shown.unmount()

  expect((await $.command.run(rings('default'))).text).toContain('Desktop shown, Terminal hidden')
  expect((await $.command.run(rings('default terminal on'))).text).toContain('New Terminal sessions start with the band shown')
  expect((await $.command.run(rings('default'))).text).toContain('Terminal shown')

  // The pane flips the same setting.
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'start-desktop' })
  expect((await pane.find({ type: 'Button', text: /Desktop/ }))?.text).toBe('○ Desktop')
  await pane.unmount()
  expect((await $.command.run(rings('default'))).text).toContain('Desktop hidden, Terminal shown')
})

// A session for the ledger tests: the store held by the test, so it can write as other sessions do.
async function ledgerSession(
  ...[$, on, store, opts]: [...Parameters<TestBody>, Map<string, unknown>, { startedAt: number; usdAtStart: number }]
) {
  const clock = mock.clock(on, { now: NOW })
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => (store.set(e.key, e.value), { value: undefined }))
  on('store.delete', (_, e) => (store.delete(e.key), { value: undefined }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('session.id', () => ({ value: 'session-a' }))
  on('command.register', () => ({ value: { command: 'rings' } }))
  on('session.usage', () => ({
    value: { startedAt: opts.startedAt, context: { window: 1000000 }, rateLimits: [], cost: { usd: opts.usdAtStart } },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const spend = (usd: number) =>
    $.session.measure({
      context: { window: 1000000, tokens: 1000, percent: 0.1 },
      rateLimits: LIMITS,
      cost: { usd },
      changed: ['context', 'rateLimits', 'cost'],
    })
  const totals = async () => {
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const text = (await band.find({ type: 'Text', text: /today/ }))?.text
    await band.unmount()
    return text
  }
  return { clock, spend, totals }
}

const MONTH = DAY.slice(0, 7)

test('a session begun today counts from its first message, and every session is summed once', async ($, on) => {
  const store = new Map<string, unknown>([
    // Another session's figure today, and one from last month that gets dropped.
    [`usd:${DAY}:session-b:${NOW}`, 3],
    ['usd:2026-09-30:session-c:0', 100],
    // The older ledgers: today's part overlaps the new figures and is left out; earlier days count.
    ['ledger', { day: DAY, month: MONTH, dayUsd: 2, monthUsd: 7 }],
    [`spend:${DAY}:session-a`, 1],
    [`spend:${MONTH}-01:session-x`, 4],
  ])
  // Begun two hours ago, $2 spent before the mod loaded.
  const { clock, spend, totals } = await ledgerSession($, on, store, { startedAt: NOW - 2 * 3_600_000, usdAtStart: 2 })
  expect(store.get(`usd:${DAY}:session-a:${NOW - 2 * 3_600_000}`)).toBe(2)
  expect(store.has('usd:2026-09-30:session-c:0')).toBe(false)

  await spend(3.5)
  // today: a 3.50 + b 3; month adds the 0.3.0 ledger's earlier days (7 - 2) and the 0.3.1 key from the 1st.
  expect(await totals()).toBe('all: today $6.50 · mo $15.50')

  // The same reading again, as after a reload or a resume, adds nothing.
  await spend(3.5)
  expect(await totals()).toBe('all: today $6.50 · mo $15.50')

  // Another session spends; this band shows it at the next minute tick.
  store.set(`usd:${DAY}:session-b:${NOW}`, 5)
  await clock.advance(60_000)
  expect(await totals()).toBe('all: today $8.50 · mo $17.50')

  // Scoped to this session, begun today: its whole cost, for the day and the month.
  await $.command.run(rings('scope session'))
  expect(await totals()).toBe('session: today $3.50 · mo $3.50')
})

test('a session begun on an earlier day counts today from when the mod saw it, and the month in full', async ($, on) => {
  const store = new Map<string, unknown>()
  const { spend, totals } = await ledgerSession($, on, store, { startedAt: NOW - 2 * 86_400_000, usdAtStart: 10 })
  // Begun this month: its whole cost counts for the month, everywhere; today only what follows.
  expect(await totals()).toBe('all: today $0.00 · mo $10.00')
  await spend(12)
  expect(await totals()).toBe('all: today $2.00 · mo $12.00')

  // Scoped to this session: the same figures, never more than every session's; the pane switches back.
  expect((await $.command.run(rings('scope session'))).text).toContain('this session')
  expect(await totals()).toBe('session: today $2.00 · mo $12.00')
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.select({ key: 'scope', value: 'all' })
  await pane.unmount()
  expect(await totals()).toBe('all: today $2.00 · mo $12.00')
})
