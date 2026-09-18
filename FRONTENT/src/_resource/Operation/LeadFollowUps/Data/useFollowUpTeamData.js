/**
 * Domain data composable for team activity and user workload distribution.
 *
 * Reads:
 *   LeadFollowUps: RespondDate, Username
 *
 * Exposes:
 *   loading             - Boolean computed, true if LeadFollowUps is loading with 0 rows
 *   teamActivity        - Top 8 team members by responses in last 48 hours ({ label, value })
 *   recentActivityCount - Count of responses logged across the team in last 48 hours
 *   controls            - Empty array (no controls)
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAuth } from 'src/composables/core/useAuth'
import { useDataContext } from 'src/composables/data/useDataContext'
import { parseAnyDate } from 'src/utils/dateHelpers'

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

export default function useFollowUpTeamData() {
  const { rows, isLoading, remember } = useRecord()
  const { user } = useAuth()
  const { topN } = useDataContext()

  return remember('useFollowUpTeamData', () => {
    const loading = computed(() => isLoading('LeadFollowUps') && rows('LeadFollowUps').length === 0)

    const allRows = computed(() => rows('LeadFollowUps'))

    const recentRows = computed(() => {
      const list = allRows.value
      const now = Date.now()
      const threshold = now - FORTY_EIGHT_HOURS
      return list.filter((r) => {
        const parsed = parseAnyDate(r.RespondDate)
        if (!parsed) return false
        const t = parsed.getTime()
        return t >= threshold && t <= now
      })
    })

    const recentActivityCount = computed(() => recentRows.value.length)

    const teamActivity = computed(() => {
      const list = recentRows.value
      const current = user.value
      const myName = (current?.name || '').trim().toLowerCase()
      const myUser = (current?.id || current?.email || '').trim().toLowerCase()

      const counts = new Map()
      for (const r of list) {
        const raw = String(r.Username || '').trim()
        if (!raw) continue

        const lower = raw.toLowerCase()
        const isMe = (myName && lower === myName) || (myUser && lower === myUser)
        const label = isMe ? 'Me' : raw

        counts.set(label, (counts.get(label) || 0) + 1)
      }

      return topN(counts, 8)
    })

    const controls = []

    return {
      loading,
      teamActivity,
      recentActivityCount,
      controls
    }
  })
}
