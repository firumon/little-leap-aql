import { niceScale, signed, formatShort } from 'src/utils/widgetGeometry.js'

export function computeBarScale (normalizedSeries, mode, categories, isWide) {
  if (!normalizedSeries || !normalizedSeries.length) {
    return { lo: 0, hi: 100, step: 25, ticks: [0, 50, 100] }
  }
  if (mode === 'percent100') {
    return { lo: 0, hi: 100, step: 25, ticks: [] }
  }
  if (mode === 'stacked') {
    const posTotals = categories.map((_, ci) => {
      return normalizedSeries.reduce((sum, s) => {
        const v = Number(s.items?.[ci]?.value) || 0
        return sum + (v > 0 ? v : 0)
      }, 0)
    })
    const negTotals = categories.map((_, ci) => {
      return normalizedSeries.reduce((sum, s) => {
        const v = Number(s.items?.[ci]?.value) || 0
        return sum + (v < 0 ? v : 0)
      }, 0)
    })
    const minVal = Math.min(0, ...negTotals)
    const maxVal = Math.max(0, ...posTotals)
    return niceScale(minVal, maxVal, isWide ? 5 : 4)
  }
  const allValues = normalizedSeries.flatMap((s) => (s.items || []).map((i) => Number(i.value) || 0))
  const minVal = Math.min(0, ...allValues)
  const maxVal = Math.max(0, ...allValues)
  return niceScale(minVal, maxVal, isWide ? 5 : 4)
}

export function computeHorizontalRows ({
  categories,
  normalizedSeries,
  scale,
  width,
  plotH,
  barWidth,
  tier,
  mode,
  getItemColor
}) {
  if (!categories || !categories.length || !normalizedSeries || !normalizedSeries.length) return []
  const rowH = Math.min(46, plotH / categories.length)
  const bh = barWidth === 'thick'
    ? Math.min(18, rowH * 0.44)
    : barWidth === 'slim'
      ? Math.min(8, rowH * 0.22)
      : Math.min(14, rowH * 0.34)
  const { lo, hi } = scale
  const span = hi - lo || 1
  const zeroX = lo >= 0 ? 0 : (Math.abs(lo) / span) * width

  return categories.map((cat, ci) => {
    const y = ci * rowH
    const barY = y + (tier === 'micro' ? (rowH - bh) / 2 : 20)

    if (mode === 'percent100') {
      const rowTotal = normalizedSeries.reduce((sum, s) => sum + Math.max(0, Number(s.items?.[ci]?.value) || 0), 0)
      let currentX = 0
      const segments = []

      normalizedSeries.forEach((s, si) => {
        const it = s.items?.[ci]
        const val = Number(it?.value) || 0
        const share = rowTotal > 0 ? val / rowTotal : 0
        const segW = share * width
        const pct = Math.round(share * 100)

        segments.push({
          x: currentX,
          y: barY,
          w: segW,
          h: bh,
          color: getItemColor(it || {}, si),
          pct,
          pctStr: `${pct}%`,
          fits: segW >= 28 && tier !== 'micro',
          textColor: si < 4 ? 'var(--aql-widget-on-fill)' : 'var(--aql-widget-ink)'
        })
        currentX += segW
      })

      return {
        label: cat,
        value: rowTotal,
        totalLabel: '',
        y,
        barY,
        barH: bh,
        trackX: 0,
        trackW: width,
        segments
      }
    }

    if (mode === 'stacked') {
      let currentPos = zeroX
      let currentNeg = zeroX
      let totalVal = 0
      const segments = []

      normalizedSeries.forEach((s, si) => {
        const it = s.items?.[ci]
        if (!it) return
        const val = Number(it.value) || 0
        totalVal += val
        const sc = (Math.abs(val) / span) * width
        let segX = zeroX

        if (val >= 0) {
          segX = currentPos
          currentPos += sc
        } else {
          currentNeg -= sc
          segX = currentNeg
        }

        segments.push({
          x: segX,
          y: barY,
          w: sc,
          h: bh,
          color: getItemColor(it, si)
        })
      })

      return {
        label: cat,
        value: totalVal,
        totalLabel: signed(totalVal),
        y,
        barY,
        barH: bh,
        trackX: 0,
        trackW: width,
        segments
      }
    }

    if (mode === 'grouped') {
      const sCount = normalizedSeries.length
      const subH = Math.max(3, (bh - 2 * (sCount - 1)) / sCount)
      const segments = []
      let totalVal = 0

      normalizedSeries.forEach((s, si) => {
        const it = s.items?.[ci]
        if (!it) return
        const val = Number(it.value) || 0
        totalVal += val
        const sc = (Math.abs(val) / span) * width
        const fillX = val < 0 ? zeroX - sc : zeroX
        segments.push({
          x: fillX,
          y: barY + si * (subH + 2),
          w: sc,
          h: subH,
          color: getItemColor(it, si)
        })
      })

      return {
        label: cat,
        value: totalVal,
        totalLabel: signed(totalVal),
        y,
        barY,
        barH: bh,
        trackX: 0,
        trackW: width,
        segments
      }
    }

    const it = normalizedSeries[0]?.items?.[ci] || { label: cat, value: 0 }
    const val = Number(it.value) || 0
    const sc = (Math.abs(val) / span) * width
    const fillW = Math.max(0, sc)
    const fillX = val < 0 ? zeroX - sc : zeroX

    return {
      label: it.label || cat,
      value: val,
      totalLabel: signed(val),
      y,
      barY,
      barH: bh,
      trackX: 0,
      trackW: width,
      segments: [
        {
          x: fillX,
          y: barY,
          w: fillW,
          h: bh,
          color: getItemColor(it, 0)
        }
      ]
    }
  })
}

export function computeVerticalColumns ({
  categories,
  normalizedSeries,
  scale,
  width,
  vPlotH,
  vZeroY,
  mode,
  getItemColor
}) {
  if (!categories || !categories.length) return []
  const count = categories.length
  const pad = 4
  const usableWidth = Math.max(10, width - pad * 2)
  const gap = count > 1
    ? Math.max(2, Math.min(16, Math.floor((usableWidth * 0.28) / (count - 1))))
    : 0
  const colW = Math.max(2, Math.floor((usableWidth - gap * (count - 1)) / count))
  const sList = normalizedSeries
  const sCount = sList.length
  const { lo, hi } = scale
  const span = hi - lo || 1

  return categories.map((cat, ci) => {
    const x = pad + ci * (colW + gap)
    const cx = x + colW / 2
    const bars = []
    let totalVal = 0
    let currentPos = vZeroY
    let currentNeg = vZeroY

    if (mode === 'stacked' || mode === 'percent100') {
      const catSum = sList.reduce((sum, s) => sum + (s.items?.[ci]?.value || 0), 0)

      sList.forEach((s, si) => {
        const it = s.items?.[ci]
        if (!it) return
        const val = Number(it.value) || 0
        totalVal += val
        const valShare = mode === 'percent100' ? (catSum ? (val / catSum) * 100 : 0) : val
        const hgt = (Math.abs(valShare) / span) * vPlotH
        let barY = 0

        if (valShare >= 0) {
          currentPos -= hgt
          barY = currentPos
        } else {
          barY = currentNeg
          currentNeg += hgt
        }

        bars.push({
          x,
          y: barY,
          w: colW,
          h: hgt,
          color: getItemColor(it, si)
        })
      })
    } else {
      const bw = mode === 'grouped' ? Math.max(3, Math.floor((colW - 3 * (sCount - 1)) / sCount)) : colW
      sList.forEach((s, si) => {
        const it = s.items?.[ci]
        if (!it) return
        const val = Number(it.value) || 0
        totalVal += val
        const hgt = (Math.abs(val) / span) * vPlotH
        const barX = mode === 'grouped' ? x + si * (bw + 3) : x
        const barY = val >= 0 ? vZeroY - hgt : vZeroY

        bars.push({
          x: barX,
          y: barY,
          w: bw,
          h: hgt,
          color: getItemColor(it, si)
        })
      })
    }

    let labelY = vZeroY - 6
    if (mode === 'stacked') {
      const topY = totalVal >= 0 ? currentPos - 6 : currentNeg + 14
      labelY = Math.max(14, Math.min(vPlotH + 20, topY))
    } else {
      const firstBar = bars[0]
      const rawY = firstBar
        ? (totalVal >= 0 ? firstBar.y - 6 : firstBar.y + firstBar.h + 14)
        : vZeroY - 6
      labelY = Math.max(14, Math.min(vPlotH + 20, rawY))
    }

    let labelAnchor = 'middle'
    let labelX = cx
    let maxLabelW = colW + gap
    let totalAnchor = 'middle'
    let totalX = cx
    if (categories.length > 1) {
      if (ci === 0) {
        labelAnchor = 'start'
        labelX = x + 2
        maxLabelW = colW + gap / 2 - 2
        if (colW < 32) {
          totalAnchor = 'start'
          totalX = x + 2
        }
      } else if (ci === categories.length - 1) {
        labelAnchor = 'end'
        labelX = x + colW - 2
        maxLabelW = colW + gap / 2 - 2
        if (colW < 32) {
          totalAnchor = 'end'
          totalX = x + colW - 2
        }
      }
    }

    return {
      cat,
      cx,
      colW,
      bars,
      labelY,
      labelAnchor,
      labelX,
      maxLabelW,
      totalAnchor,
      totalX,
      totalLabel: mode === 'single' ? signed(totalVal) : formatShort(totalVal)
    }
  })
}
