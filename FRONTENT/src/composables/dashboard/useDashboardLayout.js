import { computed } from 'vue'
import { useQuasar } from 'quasar'

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl']

function resolveColumns (columns) {
  const n = Number(columns)
  return Number.isInteger(n) && n > 0 ? n : 12
}

export function allowedWidthsFor (size, breakpoint, columns = 12) {
  const cols = resolveColumns(columns)
  if (!size || typeof size !== 'object') return [cols]

  const at = BREAKPOINTS.indexOf(breakpoint)
  const startIndex = at === -1 ? BREAKPOINTS.length - 1 : at

  let raw = null
  for (let i = startIndex; i >= 0; i--) {
    const val = size[BREAKPOINTS[i]]
    if (val !== undefined && val !== null) {
      raw = val
      break
    }
  }

  if (raw === null) return [cols]

  const list = Array.isArray(raw) ? raw : [raw]
  const valid = []
  const seen = new Set()

  for (const v of list) {
    const n = Number(v)
    if (Number.isInteger(n) && n >= 1 && n <= cols && !seen.has(n)) {
      seen.add(n)
      valid.push(n)
    }
  }

  return valid.length > 0 ? valid : [cols]
}

export function packDashboardRows (items, breakpoint, columns = 12, controlsMinSpan = 0) {
  const cols = resolveColumns(columns)
  const minSpan = Math.min(cols, Math.max(0, Number(controlsMinSpan) || 0))
  const col = {}
  const rows = []
  const emptyKeys = []

  for (const entry of items || []) {
    const key = entry.key
    const dataVal = entry.data?.value
    const loading = dataVal?.loading === true
    const empty = !loading && dataVal?.empty === true

    if (entry.hideOnEmpty && empty) {
      col[key] = 0
      emptyKeys.push(key)
      continue
    }

    let allowed = allowedWidthsFor(entry.props?.size, breakpoint, cols)
    const hasControls = Array.isArray(entry.controls) && entry.controls.length > 0

    if (hasControls && minSpan > 0) {
      const filtered = allowed.filter((w) => w >= minSpan)
      allowed = filtered.length > 0 ? filtered : [minSpan]
    }

    const defaultWidth = allowed[0]
    const otherWidths = allowed.slice(1)
    let placed = false

    for (const row of rows) {
      const remaining = cols - row.reduce((sum, t) => sum + t.width, 0)

      if (defaultWidth <= remaining) {
        row.push({ key, width: defaultWidth, allowed })
        placed = true
        break
      }

      let fitsOther = false
      for (const w of otherWidths) {
        if (w <= remaining) {
          row.push({ key, width: w, allowed })
          fitsOther = true
          placed = true
          break
        }
      }
      if (fitsOther) break

      let resizedExisting = false
      for (let i = 0; i < row.length; i++) {
        const existingTile = row[i]
        const originalWidth = existingTile.width
        const existingOtherSizes = existingTile.allowed.slice(1)

        for (const candidateSize of existingOtherSizes) {
          existingTile.width = candidateSize
          const newRemaining = cols - row.reduce((sum, t) => sum + t.width, 0)

          if (defaultWidth <= newRemaining) {
            row.push({ key, width: defaultWidth, allowed })
            resizedExisting = true
            placed = true
            break
          }

          let candidateFitsOther = false
          for (const w of otherWidths) {
            if (w <= newRemaining) {
              row.push({ key, width: w, allowed })
              candidateFitsOther = true
              resizedExisting = true
              placed = true
              break
            }
          }
          if (candidateFitsOther) break
        }

        if (placed) break
        existingTile.width = originalWidth
      }

      if (placed) break
    }

    if (!placed) {
      rows.push([{ key, width: defaultWidth, allowed }])
    }
  }

  // Row filling: expand items if there's remaining space
  for (const row of rows) {
    let remaining = cols - row.reduce((sum, t) => sum + t.width, 0)
    if (remaining <= 0) continue

    for (let i = row.length - 1; i >= 0; i--) {
      if (remaining <= 0) break
      const tile = row[i]
      const biggerSizes = tile.allowed.filter((w) => w > tile.width).sort((a, b) => b - a)

      for (const candidateSize of biggerSizes) {
        const delta = candidateSize - tile.width
        if (delta <= remaining) {
          tile.width = candidateSize
          remaining -= delta
          break
        }
      }
    }
  }

  const order = []
  for (const row of rows) {
    for (const tile of row) {
      col[tile.key] = tile.width
      order.push(tile.key)
    }
  }

  for (const key of emptyKeys) {
    order.push(key)
  }

  return { col, order }
}

export function useDashboardLayout (items, columns = 12, controlsMinSpan = 0) {
  const $q = useQuasar()

  const packed = computed(() => {
    const list = items.value || []
    const bp = $q.screen.name
    const cols = typeof columns === 'object' && columns !== null && 'value' in columns
      ? columns.value
      : columns
    const minSpan = typeof controlsMinSpan === 'object' && controlsMinSpan !== null && 'value' in controlsMinSpan
      ? controlsMinSpan.value
      : controlsMinSpan
    return packDashboardRows(list, bp, cols, minSpan)
  })

  const col = computed(() => packed.value.col)
  const order = computed(() => packed.value.order)

  return {
    col,
    order
  }
}
