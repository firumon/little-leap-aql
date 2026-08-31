import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'

/**
 * OutletDeliveries — the `ready` every SINGLE-STEP run route shares.
 *
 * Each is the same shape: load one manifest, take one note, write one row. The note is a
 * COLUMN on the manifest, bound through `useRecord`, never a control — the builder writes
 * that same column, so the box and the row the batch will send are one value, and the
 * builder's own default lands IN the box where the user can amend it.
 */
const NODE = 'OutletDeliveries'

export function liveDeliveryRun ({ commentField, build }) {
  return ({ pageState, resourceRecord }) => {
    const { user } = useAuth()
    const loaded = () => resourceRecord?.record?.value || {}

    watch(() => [
      String(loaded().Code ?? '').trim(),
      pageState.getRecord(commentField, NODE)
    ], () => {
      const record = loaded()
      const code = String(record.Code ?? '').trim()
      if (!code) return
      // Created once, never replaced: initResource would drop the note being typed.
      if (!pageState.hasNode(NODE)) pageState.initResource(NODE, { isPrimaryKey: true, code })
      pageState.applyLive(build({
        record,
        actorName: user.value?.name || user.value?.email || '',
        comment: String(pageState.getRecord(commentField, NODE) ?? '').trim()
      }), { keep: [NODE] })
    }, { immediate: true, deep: true })
  }
}
