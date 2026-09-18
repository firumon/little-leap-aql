/**
 * Domain data composable for Leads pipeline metrics and distributions.
 *
 * Reads:
 *   Leads: Progress, Area, City, Province, Type, ProgressProcessingAt, Name, Code
 *
 * Exposes:
 *   loading             - Boolean computed, true if Leads resource is loading with 0 rows
 *   openCount           - Total count of open leads (Draft or Processing)
 *   progressMix         - All leads grouped by progress bucket (topN by PROGRESS_ORDER length)
 *   leadsByPlace        - Open leads grouped by geographic level (Area, City, Province)
 *   groupBy             - Ref holding current geographic level ('Area' | 'City' | 'Province')
 *   leadsByType         - Open leads grouped by Type (top 8)
 *   processingAgeing    - Distribution of Processing leads across 4 age bands
 *   staleProcessing     - Top 5 longest Processing leads with days elapsed
 *   controls            - Array of data controls (groupBy: Area | City | Province)
 *
 * Controls:
 *   groupBy: plain picker switching geographic level between Area, City, and Province
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import {
  PROCESSING,
  PROCESSING_AGE_BANDS,
  PROGRESS_ORDER,
  progressOf,
  progressBucket,
  isOpen
} from './_shared'

export default function useLeadPipelineData() {
  const { rows, indexOf, isLoading, remember } = useRecord()
  const { topN, daysSince } = useDataContext()

  return remember('useLeadPipelineData', () => {
    const loading = computed(() => isLoading('Leads') && rows('Leads').length === 0)

    const openCount = computed(() => rows('Leads').filter(isOpen).length)

    const progressMix = computed(() => {
      const counts = new Map()
      for (const r of rows('Leads')) {
        const bucket = progressBucket(r)
        counts.set(bucket, (counts.get(bucket) || 0) + 1)
      }
      return topN(counts, PROGRESS_ORDER.length)
    })

    const groupBy = ref('Area')

    const leadsByPlace = computed(() => {
      const c = groupBy.value
      const idx = indexOf('Leads', c)
      const counts = new Map()
      for (const [val, bucket] of idx) {
        const n = bucket.filter(isOpen).length
        if (n > 0) counts.set(val, n)
      }
      return topN(counts, 8)
    })

    const leadsByType = computed(() => {
      const idx = indexOf('Leads', 'Type')
      const counts = new Map()
      for (const [val, bucket] of idx) {
        const n = bucket.filter(isOpen).length
        if (n > 0) counts.set(val, n)
      }
      return topN(counts, 8)
    })

    const processingLeads = computed(() => {
      return rows('Leads').filter((r) => progressOf(r) === PROCESSING && r.ProgressProcessingAt)
    })

    const processingAgeing = computed(() => {
      const bands = PROCESSING_AGE_BANDS.map((b) => ({ label: b.label, value: 0 }))
      for (const r of processingLeads.value) {
        const age = daysSince(r.ProgressProcessingAt)
        if (age === null || age < 0) continue
        const idx = PROCESSING_AGE_BANDS.findIndex((b) => age < b.max)
        const target = idx === -1 ? bands.length - 1 : idx
        bands[target].value++
      }
      return bands
    })

    const staleProcessing = computed(() => {
      return processingLeads.value
        .map((r) => {
          const days = daysSince(r.ProgressProcessingAt)
          return {
            label: r.Name || r.Code,
            value: Math.round(days ?? 0)
          }
        })
        .filter((it) => it.value >= 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    })

    const controls = [
      dataControl('groupBy', {
        type: 'plain',
        options: ['Area', 'City', 'Province'],
        value: groupBy
      })
    ]

    return {
      loading,
      openCount,
      progressMix,
      leadsByPlace,
      groupBy,
      leadsByType,
      processingAgeing,
      staleProcessing,
      controls
    }
  })
}
