import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-26T10:00:00Z')
const inMinutes = (m: number) => new Date(NOW + m * 60000).toISOString()

const LIMITS = [
  { kind: 'five_hour', percentUsed: 3, resetsAt: inMinutes(4 * 60 + 22) },
  { kind: 'seven_day', percentUsed: 25, resetsAt: inMinutes((4 * 24 + 17) * 60) },
  { kind: 'seven_day_fable', percentUsed: 0, resetsAt: inMinutes((4 * 24 + 17) * 60) },
]

const BAND = {
  plugin: 'usage-rings',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, scroll: { offset: 0, bodyRows: 10 } },
} as const

test('the band shows context, limits and spend on terminal and desktop', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  on('command.register', () => ({ value: { command: 'rings' } }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { window: 1000000 }, rateLimits: [], cost: { usd: 2 } },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { window: 1000000, tokens: 380000, percent: 38 },
    rateLimits: LIMITS,
    cost: { usd: 15.24 },
    changed: ['context', 'rateLimits', 'cost'],
  })

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  for (const words of ['38%', 'ctx', '5h · 4h22m', '7d · 4d17h', 'Fable · 4d17h', '$15.24', '$13.24']) {
    expect((await desktop.find({ type: 'Text', text: words }))?.text).toBe(words)
  }
  await desktop.unmount()

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const line = await terminal.find({ type: 'Text', text: /ctx/ })
  expect(line?.text).toContain('◑ 38% ctx')
  expect(line?.text).toContain('○ 3% 5h 4h22m')
  await terminal.unmount()
})
