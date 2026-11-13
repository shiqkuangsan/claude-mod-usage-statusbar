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

// What /context reports of auto-compact: absent, the session has no breakdown to give.
type Compaction = { rawMaxTokens: number; autoCompactThreshold?: number; isAutoCompactEnabled: boolean }

async function start(
  ...[$, on, surface = 'desktop', compaction]: [...Parameters<TestBody>, ('desktop' | 'terminal')?, Compaction?]
) {
  mock.clock(on, { now: NOW })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }))
  on('command.register', () => ({ value: { command: 'rings' } }))
  // Usage is on by default: with no session logs given, reading them fails and says so in the debug log.
  on('ui.log', () => ({ value: undefined as never }))
  on('session.usage', () => ({
    value: {
      startedAt: NOW - 2 * 3_600_000,
      context: { window: 1000000, ...(compaction ? { breakdown: compaction as never } : {}) },
      rateLimits: [],
      cost: { usd: 2 },
    },
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
  for (const words of ['ctx', '380k / 1M', '5h', '4h22m', '7d', '4d17h', 'Fable', '$15.24', 'all: today $15.24 · mo $15.24']) {
    expect((await desktop.find({ type: 'Text', text: words }))?.text).toBe(words)
  }
  expect(await colorOf(desktop, '$15.24')).toBe('#22c55e')
  // The session's own total says so; today and month are every session's.
  expect((await desktop.find({ type: 'Text', text: 'session' }))?.text).toBe('session')
  // The forecast is off by default: the reset countdown stays.
  expect(await desktop.find({ type: 'Text', text: /full/ })).toBe(undefined)
  // 5h at 60%: amber ring, its percentage inside, a tick where the time is.
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
  expect(line).toContain('◑ 60% ▲ 5h 4h22m')
  expect(line).toContain('◔ 25% ▽ 7d 4d17h')
  expect(line).toContain('$15.24 session · all: today $15.24 · mo $15.24')
  await terminal.unmount()

  // Turned on, the forecast says when 5h runs out at its rate so far, in amber.
  await $.command.run(rings('show forecast'))
  const forecast = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await colorOf(forecast, 'full ~25m')).toBe('#f59e0b')
  await forecast.unmount()
  const forecastLine = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await forecastLine.find({ type: 'Text', text: /ctx/ }))?.text).toContain('◑ 60% ▲ 5h full ~25m')
  await forecastLine.unmount()
})

test('ctx measures to the point auto-compact starts, so 100% is compaction, unless turned off', async ($, on) => {
  await start($, on, 'desktop', { rawMaxTokens: 400000, autoCompactThreshold: 367000, isAutoCompactEnabled: true })
  await $.session.measure({
    context: { window: 1000000, tokens: 163000, percent: 16 },
    rateLimits: LIMITS,
    cost: { usd: 15.24 },
    changed: ['context'],
  })

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // 163k of the 367k at which compaction starts, not of the 400k window it never fills.
  expect(await svgOf(desktop, 'ctx')).toContain('44%</text>')
  expect((await desktop.find({ type: 'Text', text: '204k to compact' }))?.text).toBe('204k to compact')
  // The ring's description keeps every figure, the model's window included.
  expect((await desktop.findAll({ type: 'Svg' })).find(r => String(r.props.alt).startsWith('ctx'))?.props.alt).toBe(
    'ctx: 44% used · 163k / 367k · auto-compact window 400k · model window 1M',
  )
  await desktop.unmount()
  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: /ctx/ }))?.text).toContain('◑ 44% ctx 204k to compact')
  await terminal.unmount()

  // Off: the model's window, as before.
  expect((await $.command.run(rings('ctx')))?.text).toBe(
    'Usage: /rings ctx compact|model. ctx measures against the auto-compact window now.',
  )
  expect((await $.command.run(rings('ctx model')))?.text).toBe('ctx now measures against the model window.')
  let band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await svgOf(band, 'ctx')).toContain('16%</text>')
  expect((await band.find({ type: 'Text', text: '163k / 1M' }))?.text).toBe('163k / 1M')
  await band.unmount()

  // The pane's select turns it back.
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.select({ key: 'ctx', value: 'compact' })
  await pane.unmount()
  band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await svgOf(band, 'ctx')).toContain('44%</text>')
  await band.unmount()
})

test('with auto-compact off, ctx measures against the model window', async ($, on) => {
  await start($, on, 'desktop', { rawMaxTokens: 1000000, isAutoCompactEnabled: false })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await svgOf(band, 'ctx')).toContain('38%</text>')
  expect((await band.find({ type: 'Text', text: '380k / 1M' }))?.text).toBe('380k / 1M')
  await band.unmount()
})

test('/rings switches the language, the parts, the colors and the layout', async ($, on) => {
  await start($, on)

  for (const args of ['lang zh', 'hide day ctx', 'show forecast', 'color accent #ff0000', 'theme ocean']) {
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
    // Its foot names the version: a working copy, as here, reads dev.
    expect((await pane.find({ type: 'Text', text: 'usage-rings dev' }))?.text).toBe('usage-rings dev')
    await pane.press({ key: 'part-ctx' })
    await pane.select({ key: 'mode', value: 'minimal' })
    await pane.select({ key: 'lang', value: 'zh' })
    expect((await pane.find({ type: 'Button', text: /上下文/ }))?.text).toBe('○ 上下文')
    // Every part has its button, under one of the four groups.
    expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('part-')).length).toBe(16)
    for (const group of ['圆环', '圆环细节', '花费', '速度'])
      expect((await pane.find({ type: 'Text', text: group }))?.text).toBe(group)
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
  // Usage is on by default: with no session logs given, reading them fails and says so in the debug log.
  on('ui.log', () => ({ value: undefined as never }))
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

test('a fresh session shows the last limits saved as stale until its own reading arrives', async ($, on) => {
  // Saved by an earlier session, which may have been signed in to another account.
  const store = new Map<string, unknown>([['limits', LIMITS]])
  const { spend } = await ledgerSession($, on, store, { startedAt: NOW, usdAtStart: 0 })

  const stale = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const fiveHour = await svgOf(stale, '5h')
  expect(fiveHour).toContain('60%</text>')
  expect(fiveHour).toContain('stroke="#9a9a9a"')
  expect(fiveHour).not.toContain('<line')
  expect((await stale.findAll({ type: 'Svg' })).find(r => String(r.props.alt).startsWith('5h'))?.props.alt).toBe(
    '5h: 60% used · last reading · resets in 4h22m',
  )
  expect((await stale.findAll({ type: 'Text', text: 'last reading' })).length).toBe(3)
  await stale.unmount()
  const staleLine = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await staleLine.find({ type: 'Text', text: /5h/ }))?.text).toContain('◑ 60% 5h last reading')
  await staleLine.unmount()

  // The session's first reading replaces it: colored, with the pace tick and the reset time.
  await spend(1)
  const fresh = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const live = await svgOf(fresh, '5h')
  expect(live).toContain('stroke="#f59e0b"')
  expect(live).toContain('<line')
  expect(await fresh.find({ type: 'Text', text: 'last reading' })).toBe(undefined)
  expect((await fresh.find({ type: 'Text', text: '4h22m' }))?.text).toBe('4h22m')
  await fresh.unmount()
})

// Session logs as Claude Code writes them: one line per content block, each with the response's usage.
const logLine = (id: string, at: number, model: string, u: { input: number; output: number; read: number; write: number }) =>
  JSON.stringify({
    type: 'assistant',
    requestId: `req_${id}`,
    timestamp: new Date(at).toISOString(),
    message: {
      id: `msg_${id}`,
      model,
      usage: {
        input_tokens: u.input,
        output_tokens: u.output,
        cache_read_input_tokens: u.read,
        cache_creation_input_tokens: u.write,
        cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: u.write },
      },
    },
  })

async function logSession(...[$, on, logs]: [...Parameters<TestBody>, Record<string, string>]) {
  mock.env(on, { HOME: '/h' })
  on('session.root', () => ({ value: '/work/app' }))
  const P = '/h/.claude/projects'
  on('fs.list', (_, e) => {
    const names = new Set<string>()
    const kids = Object.keys(logs).filter(f => f.startsWith(`${e.path}/`))
    if (kids.length === 0 && e.path !== P) throw new Error('ENOENT')
    const entries = kids.flatMap(f => {
      const name = f.slice(e.path.length + 1).split('/')[0] ?? ''
      if (names.has(name)) return []
      names.add(name)
      const isFile = f === `${e.path}/${name}`
      return [{ name, kind: isFile ? 'file' : 'dir', size: isFile ? logs[f]!.length : 0, mtimeMs: isFile ? NOW : 0, isLink: false }]
    })
    return { value: entries as never }
  })
  on('fs.read', (_, e) => ({ value: logs[e.path] ?? '' }))
  await start($, on)
}

test('usage: the band stays one line, and a ▾ at its end opens charts of the week, the hours, the mix and the projects', async ($, on) => {
  const P = '/h/.claude/projects'
  const yesterday = NOW - 86_400_000
  const big = { input: 1000, output: 1000, read: 100000, write: 10000 }
  const small = { input: 500, output: 500, read: 0, write: 0 }
  const line = (...rows: string[]) => rows.join('\n') + '\n'
  await logSession($, on, {
    // This session: one response logged twice (two blocks), and a subagent's response.
    [`${P}/-work-app/session-a.jsonl`]: line(
      logLine('a1', NOW - 60_000, 'claude-opus-5-5', big),
      logLine('a1', NOW - 60_000, 'claude-opus-5-5', big),
      '{"type":"user","message":{"content":"hi"}}',
    ),
    [`${P}/-work-app/session-a/subagents/agent-1.jsonl`]: line(logLine('s1', NOW - 30_000, 'claude-sonnet-5-5', small)),
    // Another session in this folder, from yesterday.
    [`${P}/-work-app/session-b.jsonl`]: line(logLine('b1', yesterday, 'claude-opus-5-5', small)),
    // Another project's work today, with a model that has no price here.
    [`${P}/-work-other/session-c.jsonl`]: line(logLine('c1', NOW - 120_000, 'some-other-model', small)),
  })

  // Closed, the band is 0.7.0's one line with a ▾ at its end: no usage tile on it.
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: /tok$/ })).toBe(undefined)
  // The tiles keep their second lines, and the rings their size.
  expect((await band.find({ type: 'Text', text: '4h22m' }))?.text).toBe('4h22m')
  expect((await band.find({ type: 'Text', text: 'all: today $15.24 · mo $15.24' }))?.text).toBe('all: today $15.24 · mo $15.24')
  expect((await band.findAll({ type: 'Svg' })).every(s => s.props.width === 32 || s.props.alt === 'dev')).toBe(true)
  expect((await band.find({ type: 'Button' }))?.text).toBe('▾')
  expect((await band.findAll({ type: 'Svg' })).some(x => String(x.props.alt).endsWith('chart'))).toBe(false)

  // ▾ opens the tiles for each scope, with rings, and the four charts; ▴ closes them.
  // 112k + 1k from the subagent. Project adds yesterday's 1k; today adds another project's 1k.
  await band.press({ key: 'usage-toggle' })
  expect((await band.find({ type: 'Button' }))?.text).toBe('▴')
  expect((await band.find({ type: 'Text', text: '113k tok' }))?.props.weight).toBe('semibold')
  expect((await band.find({ type: 'Text', text: '114k tok' }))?.text).toBe('114k tok')
  expect((await band.find({ type: 'Text', text: 'chat · 90% cache · 2 replies' }))?.text).toBe('chat · 90% cache · 2 replies')
  expect((await band.find({ type: 'Text', text: /^today · 99% of 7 days · 2 chats$/ }))?.text).toBeDefined()
  const charts = (await band.findAll({ type: 'Svg' })).filter(x => String(x.props.alt).endsWith('chart'))
  expect(charts.map(x => x.props.alt)).toEqual([
    'Last 7 days chart',
    'Today by hour chart',
    "Today's mix chart",
    'Projects · 7 days chart',
  ])
  expect(charts.every(x => x.props.isInteractive === true)).toBe(true)
  const projects = String(charts[3]?.props.source)
  // This project in the accent, named by its log folder until a line gives its folder.
  expect(projects).toContain('>work-app</text>')
  expect(projects).toContain('>work-other</text>')
  expect(String(charts[2]?.props.source)).toContain('89% cache hit')
  expect(String(charts[0]?.props.source)).toContain('<title>')
  await band.press({ key: 'usage-toggle' })
  expect((await band.find({ type: 'Button' }))?.text).toBe('▾')
  expect(await band.find({ type: 'Text', text: /replies/ })).toBe(undefined)
  await band.unmount()

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: /ctx/ }))?.text).not.toContain('tok')
  await terminal.press({ key: 'usage-toggle' })
  expect((await terminal.find({ type: 'Text', text: /^ {2}113k \$15\.24 chat/ }))?.text).toBeDefined()
  expect((await terminal.find({ type: 'Text', text: /^ {2}7d / }))?.text).toMatch(/115k tok \$0\.14\+ · avg 16k\/day$/)
  expect((await terminal.find({ type: 'Text', text: /^ {2}top / }))?.text).toContain('▸work-app 114k')
  await terminal.press({ key: 'usage-toggle' })
  await terminal.unmount()

  await $.command.run(rings('mode minimal'))
  const minimal = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await minimal.find({ type: 'Button' }))?.text).toBe('▾')
  expect(await minimal.find({ type: 'Text', text: /project/ })).toBe(undefined)
  await minimal.unmount()

  // Opus 5.5: 1k in $0.004, 1k out $0.02, 100k read $0.02, 10k 1h write $0.08; Sonnet 5.5 subagent 0.5k/0.5k $0.006.
  // Project: + yesterday's $0.012. Today and the week: + an unpriced response, so marked.
  // The chat's cost is Claude Code's own, the spend tile's.
  expect((await $.command.run(rings('usage'))).text).toBe(
    [
      'Tokens: chat 113k · project 114k · today 114k · last 7 days 115k',
      'Cost: chat $15.24 · project $0.14 · today $0.13+ · last 7 days $0.14+',
      'Today: input 112k, 89% from cache · output 2k · Opus 5.5 98% · Sonnet 5.5 1% · other 1%',
    ].join('\n'),
  )
})
