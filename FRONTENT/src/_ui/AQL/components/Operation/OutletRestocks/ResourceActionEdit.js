import { useAuth } from 'src/composables/core/useAuth'
import { restockEditableProgress } from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

/**
 * OutletRestocks › ResourceActionEdit — JS modifier (tier 4: resource-level).
 *
 * Two conditions, both required:
 *
 *   1. STATE — a restock request may be revised only while it is a DRAFT or has
 *      come back for REVISION_REQUIRED. In every other state the request is a
 *      settled workflow stamp.
 *   2. OWNERSHIP — only the person who raised the request may revise it. Editing
 *      rewrites what an approver will read as the requester's own words, so a
 *      second user editing it would be putting words in someone else's mouth.
 *
 * The owner is matched on the user's CODE, not their name: `CreatedBy` is written
 * by GAS as `auth.user.UserID` (`GAS/resourceApi.gs`), and `useAuth`'s flat user
 * projection exposes that same `APP.Users.UserID` as `user.id`
 * (Documents/API_LOGIN_RESPONSE.md §3). Names are neither unique nor stable, so
 * comparing them would hand the FAB to any namesake.
 *
 * `useAuth()` is called at MODULE level, which is safe here: it only reaches Pinia
 * stores and calls no `inject()`. `user` stays a computed, so `show` reads the
 * live session user at render time rather than whoever was signed in when this
 * module was first imported.
 *
 * `show` is function-valued so it is re-evaluated per render through
 * `evaluateProp` — a cached boolean would freeze at whatever the record's
 * Progress was on the first resolve and stay stale after a workflow action moves
 * the request in place.
 */
const { user } = useAuth()

const text = (value) => String(value ?? '').trim()

export default {
  show: (record) => {
    if (!restockEditableProgress(record?.Progress)) return false
    // An unidentified session or an unstamped record fails CLOSED. A blank on
    // either side would otherwise compare equal and show the FAB to everyone.
    const owner = text(record?.CreatedBy)
    const me = text(user.value?.id)
    return !!owner && !!me && owner === me
  },
  label: 'Edit Restock'
}
