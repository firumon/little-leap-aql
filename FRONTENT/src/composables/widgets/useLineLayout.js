import { computed } from 'vue'
import { niceScale, formatShort, truncate } from 'src/utils/widgetGeometry.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'

function parseDate (str) {
  if (!str) return NaN
  if (typeof str === 'number') return str
  const s = String(str).trim()
  const parts = s.split('-')
  if (parts.length === 3) {
    const y = Number(parts[0])
    const m = Number(parts[1]) - 1
    const d = Number(parts[2])
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 12, 0, 0).getTime()
    }
  }
  const t = new Date(s).getTime()
  return isNaN(t) ? NaN : t
}

function formatDate (t) {
  if (isNaN(t)) return ''
  const dt = new Date(t)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function buildSmoothPath (pts, top, plotH) {
  if (!pts || !pts.length) return ''
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  const n = pts.length
  const k = 0.2

  for (let i = 0; i < n - 1; i++) {
    const pPrev = pts[i === 0 ? 0 : i - 1]
    const pCurr = pts[i]
    const pNext = pts[i + 1]
    const pAfter = pts[i + 2 >= n ? n - 1 : i + 2]

    const cp1x = pCurr.x + (pNext.x - pPrev.x) * k
    let cp1y = pCurr.y + (pNext.y - pPrev.y) * k
    const cp2x = pNext.x - (pAfter.x - pCurr.x) * k
    let cp2y = pNext.y - (pAfter.y - pCurr.y) * k

    cp1y = Math.max(top, Math.min(top + plotH, cp1y))
    cp2y = Math.max(top, Math.min(top + plotH, cp2y))

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${pNext.x.toFixed(1)} ${pNext.y.toFixed(1)}`
  }
  return d
}

function buildStepPath (pts) {
  if (!pts || !pts.length) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    d += ` H ${pts[i].x.toFixed(1)} V ${pts[i].y.toFixed(1)}`
  }
  return d
}

function buildStraightPath (pts) {
  if (!pts || !pts.length) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

function buildAreaPath (lineD, pts, zeroY) {
  if (!lineD || !pts.length) return ''
  const first = pts[0]
  const last = pts[pts.length - 1]
  const rest = lineD.replace(/^M\s*[\d.]+\s+[\d.]+/, '')
  return `M ${first.x.toFixed(1)} ${zeroY.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}${rest} L ${last.x.toFixed(1)} ${zeroY.toFixed(1)} Z`
}

export function useLineLayout ({
  seriesList,
  width,
  height,
  tier,
  curve,
  fill,
  lineWidth,
  showGrid,
  showPoints,
  showEndDot,
  color,
  getSeriesColor
}) {
  const cleanSeries = computed(() => {
    return (seriesList.value || []).map((s, si) => {
      const rawPts = s.points || []
      const pts = rawPts
        .map((p) => ({
          rawX: p.x,
          t: parseDate(p.x),
          y: Number(p.y)
        }))
        .filter((p) => !isNaN(p.t) && !isNaN(p.y))
        .sort((a, b) => a.t - b.t)

      const sColor = s.color
        ? resolveCssColor(s.color)
        : (seriesList.value.length === 1 && color.value
            ? resolveCssColor(color.value)
            : getSeriesColor(si))

      return {
        name: s.name || '',
        color: sColor,
        points: pts
      }
    })
  })

  const allPoints = computed(() => cleanSeries.value.flatMap((s) => s.points))

  const hasValidData = computed(() => {
    return cleanSeries.value.length > 0 && allPoints.value.length > 0
  })

  const hasLegend = computed(() => {
    return showGrid.value && cleanSeries.value.length > 1 && tier.value !== 'micro'
  })

  const showYAxis = computed(() => {
    return showGrid.value && tier.value !== 'micro' && tier.value !== 'compact'
  })

  const showXAxis = computed(() => {
    return showGrid.value && tier.value !== 'micro'
  })

  const layoutBounds = computed(() => {
    const w = width.value || 0
    const h = height.value || 0

    const legendH = hasLegend.value ? 20 : 0
    const yLabW = showYAxis.value ? 38 : 0
    const xLabH = showXAxis.value ? 18 : 0

    const padLeft = Math.max(showEndDot.value || showPoints.value ? 6 : 4, yLabW)
    const padRight = showEndDot.value || showPoints.value ? 6 : 4
    const top = legendH + (showEndDot.value || showPoints.value ? 6 : 4)
    const bottom = xLabH + (showEndDot.value || showPoints.value ? 6 : 4)

    const plotW = Math.max(10, w - padLeft - padRight)
    const plotH = Math.max(10, h - top - bottom)

    return { padLeft, padRight, top, bottom, plotW, plotH, w, h }
  })

  const tScale = computed(() => {
    if (!allPoints.value.length) return { tMin: 0, tMax: 0 }
    const tMin = Math.min(...allPoints.value.map((p) => p.t))
    const tMax = Math.max(...allPoints.value.map((p) => p.t))
    return { tMin, tMax }
  })

  const yScale = computed(() => {
    if (!allPoints.value.length) return { lo: 0, hi: 1, step: 1, ticks: [0, 1] }
    const ys = allPoints.value.map((p) => p.y)
    const yMin = Math.min(...ys)
    const yMax = Math.max(...ys)
    return niceScale(yMin, yMax, 4)
  })

  const zeroY = computed(() => {
    const { top, plotH } = layoutBounds.value
    const { lo, hi } = yScale.value
    const span = hi - lo || 1
    const y = top + plotH - ((0 - lo) / span) * plotH
    return Math.max(top, Math.min(top + plotH, y))
  })

  const dateTicks = computed(() => {
    if (!showXAxis.value || !hasValidData.value) return []
    const { tMin, tMax } = tScale.value
    const { padLeft, top, plotH, plotW } = layoutBounds.value

    if (tMin === tMax) {
      return [{
        x: padLeft + plotW / 2,
        y: top + plotH + 14,
        label: formatDate(tMin),
        anchor: 'middle'
      }]
    }

    const n = tier.value === 'wide' ? 5 : tier.value === 'standard' ? 4 : 2
    const ticks = []
    for (let i = 0; i < n; i++) {
      const t = tMin + ((tMax - tMin) / (n - 1)) * i
      const x = padLeft + (i / (n - 1)) * plotW
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
      ticks.push({
        x,
        y: top + plotH + 14,
        label: formatDate(t),
        anchor
      })
    }
    return ticks
  })

  const gridLines = computed(() => {
    if (!showGrid.value || !hasValidData.value) return []
    const { top, plotH, padLeft, plotW } = layoutBounds.value
    const { lo, hi, ticks } = yScale.value
    const span = hi - lo || 1

    return ticks.map((v) => {
      const y = Math.max(top, Math.min(top + plotH, top + plotH - ((v - lo) / span) * plotH))
      const isZero = Math.abs(v) < 0.0001
      return {
        val: v,
        y,
        isZero,
        x1: padLeft,
        x2: padLeft + plotW,
        labelX: padLeft - 6,
        labelText: formatShort(v)
      }
    })
  })

  const seriesData = computed(() => {
    if (!hasValidData.value) return []
    const { padLeft, top, plotW, plotH } = layoutBounds.value
    const { tMin, tMax } = tScale.value
    const { lo, hi } = yScale.value
    const span = hi - lo || 1
    const tSpan = tMax - tMin || 1

    const cType = curve.value || 'smooth'
    const fType = fill.value || 'none'
    const sw = lineWidth.value === 'thin' ? 1.5 : 2.25

    return cleanSeries.value.map((s, si) => {
      const mappedPts = s.points.map((p) => {
        const x = tMin === tMax
          ? padLeft + plotW / 2
          : padLeft + ((p.t - tMin) / tSpan) * plotW
        const y = Math.max(top, Math.min(top + plotH, top + plotH - ((p.y - lo) / span) * plotH))
        return {
          x,
          y,
          val: p.y,
          rawX: p.rawX
        }
      })

      let lineD = ''
      if (cType === 'step') {
        lineD = buildStepPath(mappedPts)
      } else if (cType === 'straight') {
        lineD = buildStraightPath(mappedPts)
      } else {
        lineD = buildSmoothPath(mappedPts, top, plotH)
      }

      let areaD = ''
      if (fType !== 'none' && mappedPts.length) {
        areaD = buildAreaPath(lineD, mappedPts, zeroY.value)
      }

      const gradId = `aql-line-grad-${si}-${Math.round(top)}-${Math.round(plotH)}`
      const offsetZero = Math.max(0, Math.min(1, (zeroY.value - top) / (plotH || 1)))

      return {
        name: s.name,
        color: s.color,
        strokeWidth: sw,
        lineD,
        areaD,
        fillType: fType,
        gradId,
        offsetZero,
        points: mappedPts,
        endDot: mappedPts.length ? mappedPts[mappedPts.length - 1] : null
      }
    })
  })

  const legendItems = computed(() => {
    if (!hasLegend.value) return []
    const count = cleanSeries.value.length
    const colW = (layoutBounds.value.w - 12) / count
    return cleanSeries.value.map((s, i) => ({
      name: truncate(s.name, colW - 16, 11),
      color: s.color,
      x: 6 + i * colW
    }))
  })

  return {
    hasValidData,
    hasLegend,
    showYAxis,
    showXAxis,
    layoutBounds,
    zeroY,
    dateTicks,
    gridLines,
    seriesData,
    legendItems
  }
}
