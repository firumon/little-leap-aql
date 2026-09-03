// LeadFollowUps › the Index page's work projections. One aggregate, read by every widget.
// Downstream of Leads, so the Processing-lead denominator comes from the Leads module.

import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { parseAnyDate, toDateOnly } from 'src/utils/dateHelpers'
import { useLeadIndex } from 'src/_resource/Master/Leads/composables/useLeadIndex'
import { useLeadResource } from 'src/_resource/Master/Leads/composables/useLeadResource'
import { useFollowUpResource } from './useFollowUpResource'

const HOUR_MS = 3600000
const DAY_MS = 86400000

/** Past this many days without a response, a follow-up counts as unanswered. */
export const STALE_AFTER_DAYS = 30

/** Age bands of the last response, youngest first. `to` is inclusive. */
export const ACTIVITY_BANDS = [
  { label: '0-4 days', to: 4, color: 'positive' },
  { label: '5-8 days', to: 8, color: 'primary' },
  { label: '9-14 days', to: 14, color: 'warning' },
  { label: '15-30 days', to: STALE_AFTER_DAYS, color: 'negative' }
]

const text = (value) => (value == null ? '' : String(value).trim())

function millisOf (value) {
  const date = parseAnyDate(value)
  return date ? date.getTime() : null
}

function midnightOf (value) {
  const date = parseAnyDate(value)
  return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() : null
}

const shared = defineSharedComposable(() => {
  const { followUps, awaiting, overdue } = useFollowUpResource()
  const { liveLeads } = useLeadIndex()
  const { leads } = useLeadResource()

  /** Follow-up code → when it was responded to, in millis. Missing = never answered. */
  const respondedAt = computed(() => {
    const map = new Map()
    followUps.value.forEach((row) => {
      const stamped = millisOf(row.RespondDate)
      if (stamped !== null) map.set(row.code, stamped)
    })
    return map
  })

  const respondedWithin = (hours) => {
    const since = Date.now() - hours * HOUR_MS
    const stamps = respondedAt.value
    return followUps.value.filter((row) => {
      const at = stamps.get(row.code)
      return at !== undefined && at >= since && at <= Date.now()
    })
  }

  const doneLast24h = computed(() => respondedWithin(24))

  const overdueCount = computed(() => overdue.value.length)

  // One pass, two separate readings. A blank RespondDate has no age to measure, and a
  // reply older than STALE_AFTER_DAYS has gone quiet — both leave the age scale.
  const activityAges = computed(() => {
    const today = new Date()
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const counts = ACTIVITY_BANDS.map(() => 0)
    let noResponse = 0

    followUps.value.forEach((row) => {
      const at = midnightOf(row.RespondDate)
      const days = at === null ? null : Math.max(0, Math.round((todayMidnight - at) / DAY_MS))
      if (days === null || days > STALE_AFTER_DAYS) {
        noResponse += 1
        return
      }
      const index = ACTIVITY_BANDS.findIndex((band) => days <= band.to)
      if (index >= 0) counts[index] += 1
    })

    return { counts, noResponse }
  })

  const activityAgeBuckets = computed(() => ACTIVITY_BANDS.map((band, index) => ({
    label: band.label,
    color: band.color,
    count: activityAges.value.counts[index],
    caption: 'since last response'
  })))

  /** Never answered, or answered so long ago it has gone quiet. Off the age scale. */
  const noResponseCount = computed(() => activityAges.value.noResponse)

  // Who responded in the last 48 hours. Every alias of the signed-in user folds
  // into one row named `myLabel`.
  const teamActivityLast48h = (identities = [], myLabel = 'Me') => {
    const mine = new Set(identities.map((value) => text(value).toLowerCase()).filter(Boolean))
    const byUser = new Map()
    let sawOthers = false

    respondedWithin(48).forEach((row) => {
      const actor = text(row.Username)
      if (!actor) return
      const isMine = mine.has(actor.toLowerCase())
      if (!isMine) sawOthers = true
      const label = isMine ? myLabel : actor
      byUser.set(label, (byUser.get(label) || 0) + 1)
    })

    return {
      sawOthers,
      rows: [...byUser.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    }
  }

  /** Processing leads, and how many of them have a follow-up still booked. */
  const scheduledCoverage = computed(() => {
    const booked = new Set(awaiting.value.map((row) => row.leadCode))
    const leads = liveLeads.value
    return {
      total: leads.length,
      covered: leads.filter((lead) => booked.has(lead.code)).length
    }
  })

  /** Follow-ups already due, and how many of those carry a response. */
  const dueCompletion = computed(() => {
    const today = toDateOnly(new Date())
    const stamps = respondedAt.value
    let due = 0
    let responded = 0
    followUps.value.forEach((row) => {
      const planned = toDateOnly(row.Date)
      if (!planned || planned > today) return
      due += 1
      if (stamps.has(row.code)) responded += 1
    })
    return { due, responded }
  })

  // Leads is upstream and must never read the follow-up sheet, so the Leads ↔ LeadFollowUps
  // join lives here, on the downstream side of the cascade.

  /** `{ LeadCode: newest RespondDate in millis }`. One pass over the follow-ups. */
  const lastRespondAtByLead = computed(() => {
    const map = new Map()
    followUps.value.forEach((row) => {
      const at = millisOf(row.RespondDate)
      if (at === null) return
      const known = map.get(row.leadCode)
      if (known === undefined || at > known) map.set(row.leadCode, at)
    })
    return map
  })

  /** Newest response first. Leads nobody has answered yet sink to the end. */
  function sortLeadsByLastResponse (rows = []) {
    const stamps = lastRespondAtByLead.value
    return [...rows].sort((a, b) => {
      const left = stamps.get(text(a?.code ?? a?.Code)) ?? -Infinity
      const right = stamps.get(text(b?.code ?? b?.Code)) ?? -Infinity
      return right - left
    })
  }

  /** Every active lead, one row each, newest follow-up response first. */
  const recentlyFollowedUpLeads = computed(() => sortLeadsByLastResponse(leads.value))

  return {
    followUps,
    lastRespondAtByLead,
    sortLeadsByLastResponse,
    recentlyFollowedUpLeads,
    doneLast24h,
    overdueCount,
    activityAgeBuckets,
    noResponseCount,
    teamActivityLast48h,
    scheduledCoverage,
    dueCompletion
  }
})

export function useFollowUpIndex () {
  return shared(useDataStore())
}
