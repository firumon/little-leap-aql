// Shared SVG maths for dashboard widgets. Pure functions, no Vue.

export const TIERS = { micro: 160, compact: 280, standard: 520 }

export function tierOf (width) {
  const w = Number(width) || 0
  if (w < TIERS.micro) return 'micro'
  if (w < TIERS.compact) return 'compact'
  if (w < TIERS.standard) return 'standard'
  return 'wide'
}

const TIER_ORDER = ['micro', 'compact', 'standard', 'wide']
export function tierAtLeast (tier, floor) {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(floor)
}

export function polar (cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

export function arcPath (cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0)
  const [x1, y1] = polar(cx, cy, r, a1)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export function wedgePath (cx, cy, rInner, rOuter, a0, a1) {
  const [ax, ay] = polar(cx, cy, rOuter, a0)
  const [bx, by] = polar(cx, cy, rOuter, a1)
  const [dx, dy] = polar(cx, cy, rInner, a1)
  const [ex, ey] = polar(cx, cy, rInner, a0)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M${ax.toFixed(2)} ${ay.toFixed(2)}A${rOuter} ${rOuter} 0 ${large} 1 ${bx.toFixed(2)} ${by.toFixed(2)}` +
         `L${dx.toFixed(2)} ${dy.toFixed(2)}A${rInner} ${rInner} 0 ${large} 0 ${ex.toFixed(2)} ${ey.toFixed(2)}Z`
}

// Average glyph width as a share of font size. Good enough for Inter at chart sizes.
const CHAR_WIDTH = 0.56

export function truncate (text, maxPx, fontSize) {
  const s = String(text ?? '')
  const max = Math.floor(maxPx / (fontSize * CHAR_WIDTH))
  if (s.length <= max) return s
  return s.slice(0, Math.max(1, max - 1)).replace(/\s+$/, '') + '…'
}

export function formatNumber (n) {
  return Number(n || 0).toLocaleString('en-US')
}

export function formatShort (n) {
  const v = Number(n || 0)
  const a = Math.abs(v)
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K'
  return String(Math.round(v))
}

export function signed (n) {
  const v = Number(n || 0)
  return (v < 0 ? '−' : '') + formatNumber(Math.abs(v))
}

// Axis ticks on nice round numbers. Never the data range cut into equal parts.
// See components/widgets/CONTRACT.md part 9.4.
export function niceScale (min, max, wantedLines = 4) {
  let lo = Number(min) || 0
  let hi = Number(max) || 0
  if (lo > hi) [lo, hi] = [hi, lo]
  if (lo > 0) lo = 0
  if (hi < 0) hi = 0
  if (hi === lo) hi = lo + 1

  const raw = (hi - lo) / Math.max(1, wantedLines - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag

  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const ticks = []
  for (let v = start; v <= end + step * 0.001; v += step) {
    ticks.push(Math.abs(v) < step * 0.001 ? 0 : Number(v.toFixed(10)))
  }
  return { lo: start, hi: end, step, ticks }
}
