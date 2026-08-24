import { useAuthStore } from 'src/stores/auth'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

function text (value) {
  return String(value ?? '').trim()
}

function isActive (value) {
  return value == null || text(value) === 'Active'
}

function isCompleted (row) {
  return text(row?.Progress).toUpperCase() === 'COMPLETED'
}

function dayKey (date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// The day a visit was completed. New rows stamp `2026-08-25 12:44:12`; older rows
// still hold an epoch in millis.
function completedDay (row) {
  const stamp = row?.ProgressCompletedAt || row?.Date
  if (stamp === null || stamp === undefined || stamp === '') return ''
  if (typeof stamp === 'string' && stamp.charCodeAt(4) === 45) return stamp.slice(0, 10)
  const epoch = Number(stamp)
  const parsed = new Date(Number.isFinite(epoch) ? epoch : stamp)
  return Number.isNaN(parsed.getTime()) ? '' : dayKey(parsed)
}

/** Every string the sheet may hold for the signed-in user — a code as often as a name. */
function identitiesOf (user) {
  return [user?.name, user?.username, user?.email, user?.id, user?.code]
    .map((value) => text(value).toLowerCase())
    .filter(Boolean)
}

export default function (props, { resourceRecord }) {
  const ui = useAQLConfig()

  return {
    title: 'Visit Performance',
    layout: 'inline',
    cardClass: ui.cardClass,
    rowStaggerMs: ui.rowStaggerMs,

    series: [
      { key: 'yesterday', label: 'Yesterday', color: 'primary' },
      { key: 'today', label: 'Today', color: 'positive' }
    ],

    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const now = new Date()
      const today = dayKey(now)
      const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

      const profile = useAuthStore().userProfile
      const mine = identitiesOf(profile)
      const myLabel = text(profile?.name) || text(profile?.id) || 'Me'

      const byUser = new Map()
      let sawOthers = false

      for (const row of records) {
        if (!row || !isActive(row.Status) || !isCompleted(row)) continue

        const day = completedDay(row)
        if (day !== today && day !== yesterday) continue

        const actor = text(row.ProgressCompletedBy)
        // One person may be stamped as a code on one row and a name on the next, so
        // every alias of the signed-in user folds into a single row.
        const isMine = mine.includes(actor.toLowerCase())
        if (!isMine) sawOthers = true

        const label = isMine ? myLabel : (actor || 'Unknown')
        const entry = byUser.get(label) || { label, yesterday: 0, today: 0 }
        if (day === today) entry.today++
        else entry.yesterday++
        byUser.set(label, entry)
      }

      // A one-person board is a mirror, not a comparison.
      if (!sawOthers) return []

      return [...byUser.values()].sort((a, b) => b.today - a.today || b.yesterday - a.yesterday)
    }
  }
}
