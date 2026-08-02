// Color resolution helpers — turn a loosely-typed color keyword into a CSS color value.

import { colors } from 'quasar'

// Quasar brand colors are exposed as CSS custom properties, so they stay themable at runtime.
export const BRAND_COLORS = new Set([
  'primary', 'secondary', 'accent', 'positive', 'negative', 'info', 'warning', 'dark'
])

// Quasar Material palette families (`red`, `light-blue`, `blue-grey`, ...) with optional
// shade/accent suffix `-1` .. `-14`, plus the two standalone neutrals.
const PALETTE_RE = /^(red|pink|purple|deep-purple|indigo|blue|light-blue|cyan|teal|green|light-green|lime|yellow|amber|orange|deep-orange|brown|grey|blue-grey)(-(?:1[0-4]|[1-9]))?$|^(white|black)$/

// Anything already expressed as a CSS color value is passed through untouched.
const RAW_COLOR_RE = /^(#|rgba?\(|hsla?\(|var\(|color-mix\()/i

const paletteCache = new Map()

/**
 * Resolve any supported color string to a value usable inside CSS.
 * - Brand names   → `var(--q-primary)` (stays themable)
 * - Palette names → resolved hex via Quasar's palette (`red-10` → `#b71c1c`)
 * - Raw values    → returned as-is (`#e11d48`, `rgb(...)`, `var(...)`)
 * Unknown keywords fall back to `fallback`.
 */
export function resolveCssColor(color, fallback = 'var(--q-primary)') {
  const value = typeof color === 'string' ? color.trim() : ''
  if (!value) return fallback
  if (RAW_COLOR_RE.test(value)) return value
  if (BRAND_COLORS.has(value)) return `var(--q-${value})`
  if (!PALETTE_RE.test(value)) return fallback

  if (paletteCache.has(value)) return paletteCache.get(value)

  let resolved = fallback
  if (typeof document !== 'undefined' && document.body) {
    try {
      resolved = colors.getPaletteColor(value) || fallback
    } catch {
      resolved = fallback
    }
    paletteCache.set(value, resolved)
  }
  return resolved
}
