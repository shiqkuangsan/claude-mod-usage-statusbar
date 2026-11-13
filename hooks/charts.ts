import type { Slot, UsageBook, UsageMix } from '../types'

// The charts the band's ▾ opens: the week by day, today by hour, today's mix by kind and by
// model, and the busiest projects. Each is one image the size of the others, two to a row,
// drawn a little wider than half the band so it shrinks to fill its half; the gutter between
// the two is inside the images, on the side facing the other. Drawn in the theme's colors,
// each has its title top left and its headline figure top right; a pointer over a bar or a
// segment shows its exact figures.

type Palette = Record<Slot, string>
// The words a chart shows, in the band's language.
export type ChartWords = {
  week: string
  byHour: string
  mix: string
  projects: string
  weekdays: string[]
  kinds: { read: string; write: string; input: string; output: string }
  cacheHit: (p: number) => string
  avg: (v: string) => string
  now: (v: string) => string
  peak: (h: number) => string
  active: (n: number) => string
  replies: (n: number, saved: string) => string
  other: string
  none: string
}

// The drawing's width, the gutter beside it, and the height of every chart.
export const W = 364
export const GUTTER = 16
export const H = 124
export type Side = 'left' | 'right'
const MUTED = '#9a9a9a'
const FONT = 'font-family="-apple-system,system-ui,sans-serif"'

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
const f1 = (n: number) => n.toFixed(1)
export const tokens = (n: number) =>
  n >= 1e9 ? `${+(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`
export const money = (usd: number) => (usd >= 100 ? `$${Math.round(usd)}` : `$${usd.toFixed(2)}`)
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

const text = (x: number, y: number, s: string, o: { size?: number; color?: string; anchor?: string; weight?: number } = {}) =>
  `<text x="${f1(x)}" y="${f1(y)}" ${FONT} font-size="${o.size ?? 10}" font-weight="${o.weight ?? 500}" ` +
  `fill="${o.color ?? MUTED}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${esc(s)}</text>`
// A mark with its tooltip: the pointer over it shows `tip`.
const tipped = (tip: string, mark: string) => `<g><title>${esc(tip)}</title>${mark}</g>`
const rect = (x: number, y: number, w: number, h: number, fill: string, opacity = 1, rx = 2) =>
  `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(0, w))}" height="${f1(Math.max(0, h))}" rx="${rx}" fill="${fill}"` +
  `${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`

const frame = (side: Side, title: string, head: string, headColor: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W + GUTTER}" height="${H}" viewBox="0 0 ${W + GUTTER} ${H}">` +
  `<g${side === 'right' ? ` transform="translate(${GUTTER} 0)"` : ''}>` +
  text(0, 11, title, { size: 10.5, weight: 600 }) +
  text(W, 11, head, { size: 10.5, weight: 650, color: headColor, anchor: 'end' }) +
  body +
  `</g></svg>`

// Seven bars, today's in the accent, a dashed line at the daily average.
export function weekChart(book: UsageBook, palette: Palette, w: ChartWords, side: Side) {
  const top = 28
  const base = H - 16
  const max = Math.max(1, ...book.days.map(d => d.tokens))
  const avg = book.days.reduce((n, d) => n + d.tokens, 0) / book.days.length
  const step = W / book.days.length
  const bars = book.days
    .map((d, i) => {
      const isToday = i === book.days.length - 1
      const h = d.tokens > 0 ? Math.max(1.5, ((base - top) * d.tokens) / max) : 0
      const x = i * step + 5
      const day = new Date(d.start)
      const name = w.weekdays[day.getDay()] ?? ''
      const tip = `${name} ${day.getMonth() + 1}/${day.getDate()}: ${tokens(d.tokens)} tok · ${money(d.usd)}`
      return (
        tipped(
          tip,
          rect(x - 4, top - 10, step - 2, base - top + 12, '#000', 0, 0) +
            rect(x, base - h, step - 10, h, palette.accent, isToday ? 1 : 0.42) +
            rect(x, base, step - 10, 1, palette.track, 0.3, 0),
        ) +
        text(x + (step - 10) / 2, H - 2, name, { size: 9, anchor: 'middle', color: isToday ? palette.accent : MUTED }) +
        (d.tokens === max || isToday
          ? text(x + (step - 10) / 2, base - h - 3, tokens(d.tokens), {
              size: 8.5,
              anchor: 'middle',
              color: isToday ? palette.accent : MUTED,
            })
          : '')
      )
    })
    .join('')
  const y = base - ((base - top) * avg) / max
  const line =
    avg > 0
      ? `<line x1="0" y1="${f1(y)}" x2="${W}" y2="${f1(y)}" stroke="${palette.pace}" stroke-opacity="0.7" stroke-width="1" stroke-dasharray="3 3"/>`
      : ''
  const sum = book.days.reduce((n, d) => n + d.usd, 0)
  return frame(side, w.week, `${tokens(book.week.tokens)} · ${money(sum)}`, palette.accent, bars + line + text(0, 21, w.avg(tokens(avg)), { size: 8.5 }))
}

// Twenty-four bars: the hours gone by, the current one in the accent, those to come a stub.
export function hourChart(book: UsageBook, palette: Palette, w: ChartWords, hourNow: number, side: Side) {
  const top = 28
  const base = H - 16
  const max = Math.max(1, ...book.hours)
  const step = W / 24
  const peak = book.hours.indexOf(Math.max(...book.hours))
  const bars = book.hours
    .map((n, i) => {
      const x = i * step + 1
      const h = n > 0 ? Math.max(1.5, ((base - top) * n) / max) : 0
      const mark =
        i > hourNow
          ? rect(x, base - 1.5, step - 2, 1.5, palette.track, 0.3, 0.5)
          : rect(x, base - h, step - 2, h, palette.accent, i === hourNow ? 1 : 0.42, 1) + rect(x, base, step - 2, 1, palette.track, 0.3, 0)
      return tipped(`${String(i).padStart(2, '0')}:00–${String(i + 1).padStart(2, '0')}:00 · ${tokens(n)} tok`, rect(x, top - 10, step, base - top + 12, '#000', 0, 0) + mark)
    })
    .join('')
  const ticks = [0, 6, 12, 18, 24]
    .map(t => text(Math.min(W - 1, Math.max(1, t * step)), H - 2, String(t), { size: 9, anchor: t === 0 ? 'start' : t === 24 ? 'end' : 'middle' }))
    .join('')
  const sub = book.hours.some(n => n > 0) ? text(0, 21, w.peak(peak), { size: 8.5 }) : text(0, 21, w.none, { size: 8.5 })
  return frame(side, w.byHour, w.now(tokens(book.hour.tokens)), palette.accent, bars + ticks + sub)
}

// A stacked bar of parts, each with its tooltip, and a legend of two columns beneath.
const stack = (y: number, parts: { label: string; n: number; color: string; opacity: number; tip: string; note: string }[]) => {
  const total = parts.reduce((n, p) => n + p.n, 0)
  let x = 0
  const bar =
    rect(0, y, W, 9, MUTED, 0.18, 2) +
    parts
      .map(p => {
        const width = total > 0 ? (W * p.n) / total : 0
        const mark = width > 0 ? tipped(p.tip, rect(x, y, width, 9, p.color, p.opacity, 0)) : ''
        x += width
        return mark
      })
      .join('')
  const legend = parts
    .map((p, i) => {
      const lx = (i % 2) * (W / 2)
      const ly = y + 22 + Math.floor(i / 2) * 14
      return rect(lx, ly - 7.5, 8, 8, p.color, p.opacity, 1.5) + text(lx + 12, ly, `${p.label} ${p.note}`, { size: 9.5 })
    })
    .join('')
  return bar + legend
}

// Today's tokens by kind (cache read, cache write, input, output), and by model.
export function mixChart(mix: UsageMix, palette: Palette, w: ChartWords, side: Side) {
  const total = mix.input + mix.output + mix.read + mix.write
  const inTotal = mix.input + mix.read + mix.write
  const kind = (label: string, n: number, color: string, opacity: number) => ({
    label,
    n,
    color,
    opacity,
    tip: `${label}: ${tokens(n)} tok · ${pct(n, total)}%`,
    note: `${tokens(n)} ${pct(n, total)}%`,
  })
  const kinds = [
    kind(w.kinds.read, mix.read, palette.accent, 1),
    kind(w.kinds.write, mix.write, palette.accent, 0.55),
    kind(w.kinds.input, mix.input, palette.pace, 0.8),
    kind(w.kinds.output, mix.output, palette.warn, 1),
  ]
  const models = mix.models.slice(0, 3)
  const rest = mix.models.slice(3)
  const modelTotal = mix.models.reduce((n, m) => n + m.tokens, 0)
  const opacities = [1, 0.6, 0.32]
  const byModel = [
    ...models.map((m, i) => ({
      label: modelName(m.id),
      n: m.tokens,
      color: palette.accent,
      opacity: opacities[i] ?? 0.3,
      tip: `${modelName(m.id)}: ${tokens(m.tokens)} tok · ${money(m.usd)}`,
      note: `${pct(m.tokens, modelTotal)}% ${money(m.usd)}`,
    })),
    ...(rest.length > 0
      ? [
          {
            label: w.other,
            n: rest.reduce((n, m) => n + m.tokens, 0),
            color: palette.track,
            opacity: 0.5,
            tip: rest.map(m => `${modelName(m.id)} ${tokens(m.tokens)}`).join(' · '),
            note: `${pct(
              rest.reduce((n, m) => n + m.tokens, 0),
              modelTotal,
            )}%`,
          },
        ]
      : []),
  ]
  const foot = byModel.length <= 2 ? text(0, H - 2, w.replies(mix.responses, money(mix.savedUsd)), { size: 9 }) : ''
  return frame(side, w.mix, w.cacheHit(pct(mix.read, inTotal)), palette.accent, stack(20, kinds) + stack(70, byModel.slice(0, 4)) + foot)
}

// The busiest project folders of the week, this one in the accent: each a row of its whole
// name and figures, with its bar beneath, so no text sits on a bar.
export function projectChart(book: UsageBook, palette: Palette, w: ChartWords, side: Side) {
  const rows = book.projects
  const max = Math.max(1, ...rows.map(p => p.tokens))
  const body = rows
    .map((p, i) => {
      const y = 20 + i * 20.5
      const color = p.isThis ? palette.accent : MUTED
      const figures = `${tokens(p.tokens)} · ${money(p.usd)} · ${pct(p.tokens, book.week.tokens)}%`
      // A name too long to sit beside its figures keeps its end, where folder names differ.
      const room = Math.floor((W - figures.length * 5.6 - 12) / 5.8)
      const name = p.name.length > room ? `…${p.name.slice(-(room - 1))}` : p.name
      return tipped(
        `${p.name}: ${tokens(p.tokens)} tok · ${money(p.usd)}`,
        rect(0, y, W, 20, '#000', 0, 0) +
          text(0, y + 9, name, { size: 9.5, color, weight: p.isThis ? 650 : 500 }) +
          text(W, y + 9, figures, { size: 9.5, anchor: 'end', color }) +
          rect(0, y + 12.5, W, 4, palette.track, 0.18, 2) +
          rect(0, y + 12.5, Math.max(3, (W * p.tokens) / max), 4, palette.accent, p.isThis ? 1 : 0.42, 2),
      )
    })
    .join('')
  return frame(side, w.projects, w.active(book.projects.length), palette.accent, body || text(0, 34, w.none, { size: 9.5 }))
}

// `claude-opus-5-5` as `Opus 5.5`, `claude-3-5-haiku-20241022` as `Haiku 3.5`; any other id as is.
export const modelName = (id: string) => {
  if (!id.startsWith('claude-')) return id || '?'
  const parts = id.slice('claude-'.length).split('-').filter(p => !/^\d{8}$/.test(p))
  const family = parts.find(p => /^[a-z]+$/.test(p))
  const version = parts.filter(p => /^\d+$/.test(p)).join('.')
  return family ? `${family[0]?.toUpperCase()}${family.slice(1)}${version ? ` ${version}` : ''}` : id
}

// The terminal's bars: one block glyph per value, its height the value's share of the largest.
const BLOCKS = ' ▁▂▃▄▅▆▇█'
export const sparkline = (values: number[]) => {
  const max = Math.max(1, ...values)
  return values.map(v => (v > 0 ? (BLOCKS[Math.max(1, Math.round((v / max) * 8))] ?? '█') : '·')).join('')
}
// A bar of `width` cells split by share, each part its own glyph.
export const shareBar = (parts: number[], width: number, glyphs = ['█', '▓', '▒', '░']) => {
  const total = parts.reduce((n, p) => n + p, 0)
  if (total === 0) return '·'.repeat(width)
  let out = ''
  let used = 0
  parts.forEach((p, i) => {
    const cells = i === parts.length - 1 ? width - used : Math.round((p / total) * width)
    out += (glyphs[i] ?? '░').repeat(Math.max(0, cells))
    used += Math.max(0, cells)
  })
  return out.slice(0, width)
}
