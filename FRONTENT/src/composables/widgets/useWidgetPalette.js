import { resolveCssColor } from 'src/utils/colorHelpers.js'

export const SERIES = [
  'var(--q-primary)',
  'var(--q-secondary)',
  'var(--q-accent)',
  'var(--q-info)',
  'color-mix(in srgb, var(--q-primary) 65%, white)',
  'color-mix(in srgb, var(--q-secondary) 65%, white)',
  'color-mix(in srgb, var(--q-primary) 40%, white)',
  'color-mix(in srgb, var(--q-secondary) 40%, white)'
]

export function useWidgetPalette () {
  function getSeriesColor (index, customColor) {
    if (customColor) return resolveCssColor(customColor)
    const idx = Math.abs(Number(index) || 0) % SERIES.length
    return SERIES[idx]
  }

  return {
    series: SERIES,
    getSeriesColor
  }
}
