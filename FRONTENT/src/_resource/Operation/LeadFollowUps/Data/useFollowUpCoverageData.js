/**
 * Domain data composable for lead coverage, unbooked processing leads, and activity recency.
 *
 * Reads:
 *   Leads: Code, Name, Progress, ProgressProcessingAt
 *   LeadFollowUps: LeadCode, Progress, RespondDate
 *
 * Exposes:
 *   loading                 - Boolean computed, true if Leads or LeadFollowUps is loading with 0 rows
 *   unscheduledCount        - Count of Processing leads without any upcoming awaiting follow-up
 *   unscheduledOver30Count  - Count of unscheduled Processing leads in processing > 30 days
 *   neverFollowedUp         - Top 5 Processing leads with zero follow-up records ({ label, value: days })
 *   activityAgeing          - Distribution of follow-ups across activity recency bands + No reply
 *   controls                - Empty array (no controls)
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { PROCESSING, progressOf } from 'src/_resource/Master/Leads/composables/useLeadProgress'
import { ACTIVITY_BANDS, STALE_AFTER_DAYS, isAwaiting } from './_shared'

export default function useFollowUpCoverageData() {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince } = useDataContext()

  return remember('useFollowUpCoverageData', () => {
    const loading = computed(() => {
      const leadsLoading = isLoading('Leads') && rows('Leads').length === 0
      const fuLoading = isLoading('LeadFollowUps') && rows('LeadFollowUps').length === 0
      return leadsLoading || fuLoading
    })

    const processingLeads = computed(() => {
      return rows('Leads').filter((r) => progressOf(r) === PROCESSING)
    })

    const booked = computed(() => {
      return new Set(
        rows('LeadFollowUps')
          .filter(isAwaiting)
          .map((f) => String(f.LeadCode).trim())
          .filter(Boolean)
      )
    })

    const unscheduled = computed(() => {
      const bookedSet = booked.value
      return processingLeads.value.filter((l) => !bookedSet.has(String(l.Code).trim()))
    })

    const unscheduledCount = computed(() => unscheduled.value.length)

    const unscheduledOver30Count = computed(() => {
      return unscheduled.value.filter((l) => (daysSince(l.ProgressProcessingAt) ?? 0) > 30).length
    })

    const contacted = computed(() => {
      return new Set(
        rows('LeadFollowUps').map((f) => String(f.LeadCode).trim()).filter(Boolean)
      )
    })

    const neverContacted = computed(() => {
      const contactedSet = contacted.value
      return processingLeads.value.filter((l) => !contactedSet.has(String(l.Code).trim()))
    })

    const neverFollowedUp = computed(() => {
      return neverContacted.value
        .map((l) => {
          const days = daysSince(l.ProgressProcessingAt)
          return {
            label: l.Name || l.Code,
            value: Math.round(days ?? 0)
          }
        })
        .filter((it) => it.value >= 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    })

    const activityAgeing = computed(() => {
      const bands = ACTIVITY_BANDS.map((b) => ({ label: b.label, value: 0 }))
      let noReply = 0

      for (const r of rows('LeadFollowUps')) {
        const age = daysSince(r.RespondDate)
        if (age === null || age < 0 || age > STALE_AFTER_DAYS) {
          noReply++
          continue
        }
        const idx = ACTIVITY_BANDS.findIndex((b) => age <= b.to)
        if (idx !== -1) {
          bands[idx].value++
        } else {
          noReply++
        }
      }

      bands.push({ label: 'No reply', value: noReply })
      return bands
    })

    const controls = []

    return {
      loading,
      unscheduledCount,
      unscheduledOver30Count,
      neverFollowedUp,
      activityAgeing,
      controls
    }
  })
}
