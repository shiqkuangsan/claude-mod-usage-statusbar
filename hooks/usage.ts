import type { EngineInterface } from 'claude-code'

import type { UsageBook, UsageDay, UsageFigure, UsageMix, UsageProject } from '../types'

// Token and cost totals for this conversation, its project folder, today and the last seven days, read from the
// session logs Claude Code keeps under <config>/projects, the way Token Monitor counts them.

// $ per million tokens: input, output, cache read. A cache write costs 1.25x input for five
// minutes, 2x for an hour. First match wins, so a model's own row comes before its family's.
const PRICES: [RegExp, number, number, number][] = [
  [/^claude-(fable|mythos)-5-1/, 10, 50, 0.25],
  [/^claude-(fable|mythos)-5/, 10, 50, 1],
  [/^claude-opus-5-5/, 4, 20, 0.2],
  [/^claude-opus-5/, 5, 25, 0.5],
  [/^claude-opus-4-[5-9]/, 5, 25, 0.5],
  [/^claude-opus-4/, 15, 75, 1.5],
  [/^claude-sonnet-5/, 2, 10, 0.2],
  [/^claude-(sonnet-4|3-7-sonnet|3-5-sonnet)/, 3, 15, 0.3],
  [/^claude-haiku-5-5/, 0.1, 0.5, 0.01],
  [/^claude-haiku-4-5/, 1, 5, 0.1],
  [/^claude-3-5-haiku/, 0.8, 4, 0.08],
]
// Haiku 5.5 bills a prompt over this many tokens at five times its rates.
const HAIKU_LONG = 100_000

// One API response, as a log line records it. A response is logged once per content block,
// each line with the same usage, so `key` (message id and request id) counts it once.
type Rec = {
  key: string
  at: number
  model: string
  input: number
  output: number
  read: number
  write: number
  tokens: number
  usd: number | undefined
  // What the cache reads saved against paying for them as fresh input.
  saved: number
}
// What a log file held when last read, and how far: logs only grow, so a file that grew past
// what `$.fs.read` takes is read on from `offset`.
// `cwd` is the folder the session ran in, as its lines record it: what names the project.
type FileScan = { stamp: string; offset: number; recs: Rec[]; isPartial: boolean; cwd?: string }

const MAX_READ = 4 * 1024 * 1024
const files = new Map<string, FileScan>()
const utf8 = new TextEncoder()

const priceOf = (model: string) => PRICES.find(([re]) => re.test(model.replace(/^.*?(?=claude-)/, '')))
const usdOf = (model: string, input: number, output: number, read: number, write5m: number, write1h: number, isFast: boolean) => {
  const id = model.replace(/^.*?(?=claude-)/, '')
  const price = priceOf(id)
  if (!price) return undefined
  const [, inRate, outRate, readRate] = price
  const long = /^claude-haiku-5-5/.test(id) && input + read + write5m + write1h > HAIKU_LONG ? 5 : 1
  const fast = isFast ? 2 : 1
  return (
    ((input * inRate + output * outRate + read * readRate + write5m * inRate * 1.25 + write1h * inRate * 2) * long * fast) / 1e6
  )
}

type LogUsage = {
  input_tokens?: unknown
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number }
  speed?: string
}

// The usage object closing at the first `}` that balances its opening brace.
const objectAt = (line: string, from: number) => {
  let depth = 0
  for (let i = from; i < line.length; i++) {
    const c = line[i]
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return line.slice(from, i + 1)
  }
  return undefined
}
const field = (line: string, name: string) => new RegExp(`"${name}":"([^"]+)"`).exec(line)?.[1]

// Parsing every line whole stalls the module on large tool results, so only the fields counted
// are picked out. A quote inside the logged text is escaped, so `"name":"` matches a field.
const recOf = (line: string, at: string): Rec | undefined => {
  if (!line.includes('"type":"assistant"')) return undefined
  const start = line.lastIndexOf('"usage":{"input_tokens"')
  if (start < 0) return undefined
  let u: LogUsage
  try {
    u = JSON.parse(objectAt(line, start + '"usage":'.length) ?? '') as LogUsage
  } catch {
    return undefined
  }
  if (typeof u.input_tokens !== 'number') return undefined
  const id = /"id":"(msg_[^"]+)"/.exec(line)?.[1]
  const model = field(line, 'model') ?? ''
  const input = u.input_tokens
  const output = u.output_tokens ?? 0
  const read = u.cache_read_input_tokens ?? 0
  const write = u.cache_creation_input_tokens ?? 0
  const tokens = input + output + read + write
  if (tokens === 0) return undefined
  const write1h = Math.min(write, u.cache_creation?.ephemeral_1h_input_tokens ?? 0)
  return {
    key: id ? `${id}:${field(line, 'requestId') ?? ''}` : (field(line, 'uuid') ?? at),
    at: Date.parse(field(line, 'timestamp') ?? ''),
    model: model.replace(/^.*?(?=claude-)/, ''),
    input,
    output,
    read,
    write,
    tokens,
    usd: usdOf(model, input, output, read, write - write1h, write1h, u.speed === 'fast'),
    saved: (() => {
      const price = priceOf(model)
      return price ? (read * (price[1] - price[3])) / 1e6 : 0
    })(),
  }
}

// Resolves once no response is streaming in: the band's `turn.step` hook shares this module's
// one thread, and its budget runs on while a read here holds it.
export type Idle = () => Promise<void>

// Each whole line of `text` read into `recs`; what follows the last newline is not yet a line.
// Every few hundred lines it hands the engine a turn, and waits while a response streams in.
async function readLines($: EngineInterface, idle: Idle, text: string, recs: Rec[], where: string, seen: { cwd?: string }) {
  const end = text.lastIndexOf('\n')
  const lines = end < 0 ? [] : text.slice(0, end).split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && i % 200 === 0) {
      await idle()
      await $.clock.now()
    }
    const line = lines[i] ?? ''
    seen.cwd ??= field(line, 'cwd')?.replace(/\\\\/g, '\\')
    const rec = recOf(line, `${where}:${i}`)
    if (rec) recs.push(rec)
  }
  return end < 0 ? '' : text.slice(0, end + 1)
}

async function scanFile($: EngineInterface, idle: Idle, path: string, size: number, mtimeMs: number): Promise<FileScan> {
  const stamp = `${size}:${mtimeMs}`
  const kept = files.get(path)
  if (kept?.stamp === stamp) return kept
  let scan: FileScan
  if (size <= MAX_READ) {
    const recs: Rec[] = []
    const seen: { cwd?: string } = {}
    try {
      const used = await readLines($, idle, await $.fs.read(path), recs, path, seen)
      scan = { stamp, offset: utf8.encode(used).length, recs, isPartial: false, cwd: seen.cwd }
    } catch {
      scan = { stamp, offset: 0, recs: [], isPartial: true }
    }
  } else {
    // Past what one read takes: `tail` streams the file on from where the last read stopped.
    const from = kept && !kept.isPartial && kept.offset <= size ? kept.offset : 0
    const recs = from > 0 && kept ? [...kept.recs] : []
    let offset = from
    let carry = ''
    let isPartial = false
    const seen: { cwd?: string } = { cwd: from > 0 ? kept?.cwd : undefined }
    try {
      for await (const piece of $.process.spawn({ argv: ['tail', '-c', `+${from + 1}`, path] })) {
        if (piece.stream !== 'stdout') continue
        const used = await readLines($, idle, carry + piece.text, recs, `${path}@${offset}`, seen)
        offset += utf8.encode(used).length
        carry = (carry + piece.text).slice(used.length)
      }
    } catch {
      isPartial = true
    }
    scan = { stamp, offset, recs, isPartial, cwd: seen.cwd }
  }
  files.set(path, scan)
  return scan
}

async function list($: EngineInterface, dir: string) {
  try {
    return await $.fs.list(dir)
  } catch {
    return []
  }
}

async function projectsDir($: EngineInterface) {
  const config = await $.env.get('CLAUDE_CONFIG_DIR')
  if (config) return `${config.replace(/[\\/]+$/, '')}/projects`
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  return home ? `${home.replace(/[\\/]+$/, '')}/.claude/projects` : undefined
}

// The local midnight `daysBack` days before the one `t` falls on.
const localDayStart = (t: number, daysBack = 0) => {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBack).getTime()
}

type Sum = { figure: UsageFigure; seen: Set<string>; mix?: UsageMix; byModel?: Map<string, { tokens: number; usd: number }> }
const newSum = (withMix = false): Sum => ({
  figure: { tokens: 0, usd: 0, isPartial: false, hasUnpriced: false },
  seen: new Set(),
  ...(withMix
    ? { mix: { input: 0, output: 0, read: 0, write: 0, savedUsd: 0, responses: 0, models: [] }, byModel: new Map() }
    : {}),
})
// Adds each response `keep` takes and the sum has not counted yet; `each` sees every one it adds.
const add = (sum: Sum, scan: FileScan, keep: (r: Rec) => boolean, each?: (r: Rec) => void) => {
  if (scan.isPartial) sum.figure.isPartial = true
  for (const r of scan.recs) {
    if (!keep(r) || sum.seen.has(r.key)) continue
    sum.seen.add(r.key)
    sum.figure.tokens += r.tokens
    if (r.usd === undefined) sum.figure.hasUnpriced = true
    else sum.figure.usd += r.usd
    if (sum.mix && sum.byModel) {
      sum.mix.input += r.input
      sum.mix.output += r.output
      sum.mix.read += r.read
      sum.mix.write += r.write
      sum.mix.savedUsd += r.saved
      sum.mix.responses++
      const m = sum.byModel.get(r.model) ?? { tokens: 0, usd: 0 }
      sum.byModel.set(r.model, { tokens: m.tokens + r.tokens, usd: m.usd + (r.usd ?? 0) })
    }
    each?.(r)
  }
}
const mixOf = (sum: Sum): UsageMix => {
  const mix = sum.mix ?? { input: 0, output: 0, read: 0, write: 0, savedUsd: 0, responses: 0, models: [] }
  mix.models = [...(sum.byModel ?? [])].map(([id, m]) => ({ id, ...m })).sort((a, b) => b.tokens - a.tokens)
  return mix
}
const baseName = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? path

// The session's log is `<project>/<session id>.jsonl`, its subagents' under
// `<project>/<session id>/subagents/`. The project folder is the one that holds the session's log,
// or before its first line is written, the one named after the project root as Claude Code names it.
export async function scanUsage(
  $: EngineInterface,
  sessionId: string,
  now: number,
  idle: Idle,
): Promise<Omit<UsageBook, 'day'> | undefined> {
  const root = (await $.session.root()).replace(/[^a-zA-Z0-9]/g, '-')
  const base = await projectsDir($)
  if (!base) return undefined
  const dayStart = localDayStart(now)
  const weekStart = localDayStart(now, 6)
  const hourAgo = now - 3_600_000
  const session = newSum(true)
  const project = newSum()
  const today = newSum(true)
  const week = newSum()
  const hour = newSum()
  // The week day by day, oldest first; today hour by hour; and every project's week.
  const days: UsageDay[] = Array.from({ length: 7 }, (_, i) => ({ start: localDayStart(now, 6 - i), tokens: 0, usd: 0 }))
  const hours = Array.from({ length: 24 }, () => 0)
  const projects = new Map<string, UsageProject>()
  const chats = new Set<string>()
  let found = false
  for (const dir of await list($, base)) {
    if (dir.kind !== 'dir') continue
    const path = `${base}/${dir.name}`
    const entries = await list($, path)
    const isProject = entries.some(f => f.name === `${sessionId}.jsonl`) || dir.name === root
    found ||= isProject
    const logs: { file: string; owner: string; size: number; mtimeMs: number }[] = []
    for (const f of entries) {
      if (f.kind !== 'file' || !f.name.endsWith('.jsonl')) continue
      if (!isProject && f.mtimeMs < weekStart) continue
      const owner = f.name.slice(0, -'.jsonl'.length)
      logs.push({ file: `${path}/${f.name}`, owner, size: f.size, mtimeMs: f.mtimeMs })
      // Subagents run within their session, so a session active this week is where to look for them.
      if (entries.some(d => d.kind === 'dir' && d.name === owner)) {
        for (const s of await list($, `${path}/${owner}/subagents`)) {
          if (s.kind === 'file' && s.name.endsWith('.jsonl') && (isProject || s.mtimeMs >= weekStart))
            logs.push({ file: `${path}/${owner}/subagents/${s.name}`, owner, size: s.size, mtimeMs: s.mtimeMs })
        }
      }
    }
    const scans: FileScan[] = []
    for (const log of logs) {
      const scan = await scanFile($, idle, log.file, log.size, log.mtimeMs)
      scans.push(scan)
      if (isProject) add(project, scan, () => true)
      if (isProject && log.owner === sessionId) add(session, scan, () => true)
      add(today, scan, r => r.at >= dayStart, r => {
        hours[new Date(r.at).getHours()]! += r.tokens
        chats.add(log.owner)
      })
      add(hour, scan, r => r.at >= hourAgo)
    }
    // The project's name is the folder its sessions ran in; its log folder's name stands in before one is read.
    const name = baseName(scans.find(x => x.cwd)?.cwd ?? dir.name.replace(/^-+/, ''))
    const mine: UsageProject = { name, tokens: 0, usd: 0, isThis: isProject }
    for (const scan of scans)
      add(week, scan, r => r.at >= weekStart, r => {
        const day = [...days].reverse().find(d => r.at >= d.start)
        if (day) {
          day.tokens += r.tokens
          day.usd += r.usd ?? 0
        }
        mine.tokens += r.tokens
        mine.usd += r.usd ?? 0
      })
    if (mine.tokens > 0) projects.set(dir.name, mine)
  }
  if (!found) return undefined
  return {
    session: session.figure,
    project: project.figure,
    today: today.figure,
    week: week.figure,
    hour: hour.figure,
    mix: mixOf(today),
    chatMix: mixOf(session),
    days,
    hours,
    projects: [...projects.values()].sort((a, b) => b.tokens - a.tokens).slice(0, 5),
    chats: chats.size,
  }
}
