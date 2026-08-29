import { computed, onMounted, watch } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRestockFormContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockFormContext'

/**
 * OutletRestocks › Edit — hydration + read-model behind `EditRestockHeader`.
 *
 * The Edit page contract deliberately drops the generic `Update` content, because
 * a restock must be edited through the same item cards the Add wizard uses, not
 * through a field-by-field form. `Update.vue` is also the component that normally
 * loads the server record and its child rows into pageState, so dropping it means
 * that hydration has to happen here instead — everything downstream
 * (`useRestockStockMatch`, `Edit/PageAction.js`) reads pageState and nothing else.
 *
 * Hydration is one-shot per (node instance, server record), keyed exactly the way
 * `Update.vue` keys it: a re-render must never clobber quantities the user has
 * already adjusted, but a node replacement (PageAction's reset) must re-seed.
 *
 * ONE reactive source of truth (ARCHITECTURE RULES §6): nothing here mirrors the
 * record into local refs — `outletName`/`restockDate`/`comment` are projections of
 * pageState plus the Outlets rows, and `setComment` writes straight back.
 */
const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'

// Matches the normalizer in `useRestockStockMatch`, which is what will address
// these rows once they are in pageState — the two must agree on what "the same
// SKU" means or this dedupe would pass rows that the cards then merge anyway.
const skuKey = (value) => String(value ?? '').trim().toLowerCase()
const isActive = (row) => (row?.Status || 'Active') === 'Active'
const text = (value) => String(value ?? '').trim()

export function useRestockEditForm () {
  // Injected once for the Add + Edit pages, by the shared relay (§6.1) — the two
  // pages resolve the same resource-tier item cards, so the relay sits above both
  // and is the single `inject()` caller behind either of them.
  const { pageState, resourceRecord } = useRestockFormContext()

  // Same accessor idiom as the Add wizard, so the whole restock flow reads
  // resources through `useRecord` and imports no store (ARCHITECTURE RULES §5).
  const outlets = useRecord('Outlets')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')
  const outletStorages = useRecord('OutletStorages')
  const warehouseStorages = useRecord('WarehouseStorages')

  const parent = pageState.useNode(PARENT)
  const serverRecord = computed(() => resourceRecord?.record?.value || null)

  // Hydration bookkeeping lives on the NODE, not in this closure.
  //
  // More than one component on the page calls this composable (`EditRestockHeader`
  // and `EditSubmitOptions`), and each call gets its own closure — so a per-call
  // `let hydratedKey` would let the second instance re-run the whole pass: it
  // would reload the record over whatever the user had typed, and, worse, append
  // a SECOND copy of every item line. A control field is scoped to the node
  // itself, so it is shared by every caller and is discarded with the node when
  // PageAction resets it, which is exactly the lifetime this flag needs.
  const HYDRATED_FOR = 'EditHydratedFor'
  const hydratedFor = () => (pageState.hasNode(PARENT)
    ? text(pageState.getControls(HYDRATED_FOR, null, PARENT))
    : '')

  function hydrate () {
    const record = serverRecord.value
    if (!pageState || !record) return
    const code = text(record.Code)
    if (!code) return

    // The record's CODE is what the node is hydrated FOR, and a change of code
    // means a different restock — never a re-render of this one.
    //
    // Reused rather than re-created is how a node leaks: `hasNode` is true for
    // the whole resource, so walking from restock A's edit page to restock B's
    // kept A's node and every control on it. `reset: true` detaches the node
    // outright, which is the only thing that clears `controls` — the draft
    // toggle, and on the action pages the comment and the allocation plan.
    //
    // Keyed on the Code rather than on the record OBJECT's identity: a
    // background sync hands back a fresh enriched object for the same row, and
    // re-hydrating on that would wipe edits the user had already made.
    if (hydratedFor() !== code) {
      pageState.initResource(PARENT, { isPrimaryKey: true, reset: true, code })
      if (!parent.exists.value) return

      pageState.setControls(HYDRATED_FOR, code, PARENT)
      pageState.load(record, PARENT)

      // Default the draft toggle ON when entering an existing DRAFT record. A
      // user who opens their draft to adjust item lines and hits the primary
      // button must save it, not accidentally submit it — the OFF default was
      // the opposite intent. No `else`: the node is fresh, so anything that is
      // not a DRAFT already reads as false.
      if (text(record.Progress) === 'DRAFT') {
        pageState.setControls('isDraft', true, PARENT)
      }
    }

    // The node's OWN children are the record of whether the lines were seeded.
    // Asking pageState rather than a local flag is what makes a second caller a
    // no-op instead of a duplicate-line generator.
    if (parent.children(CHILD).value.length) return
    const rows = (resourceRecord?.childRecordsByResource?.value || {})[CHILD]
    if (!Array.isArray(rows) || !rows.length) return

    // One line per SKU. The item cards address a line BY SKU, so a second row for
    // the same SKU is a line the UI can never reach: the card reads the SKU's total
    // while the buttons edit a single line, so the surplus row survives every edit
    // and still rides along in the payload. An Active row wins over an
    // already-deactivated one; rows carrying no SKU are left alone, since nothing
    // addresses them by SKU in the first place.
    const primaryBySku = new Map()
    rows.forEach((row) => {
      const sku = skuKey(row.SKU)
      if (!sku) return
      const current = primaryBySku.get(sku)
      if (!current || (!isActive(current) && isActive(row))) primaryBySku.set(sku, row)
    })

    // Relation/metadata keys are non-enumerable, so the spread yields only schema
    // headers. `update` (not `create`) so GAS patches the existing lines.
    rows.forEach((row) => {
      const sku = skuKey(row.SKU)
      if (sku && primaryBySku.get(sku) !== row) return
      pageState.addChild(CHILD, { ...row }, PARENT, null, { action: 'update' })
    })
  }

  watch(
    [serverRecord, () => parent.identifier.value, () => resourceRecord?.childRecordsByResource?.value],
    () => { hydrate() },
    { immediate: true }
  )

  onMounted(() => {
    // The item cards project (SKUs × Products × OutletStorages × pageState), so
    // those rows must be present or the Edit page renders two empty lists. Add
    // loads them at step 1; Edit has no step 1, so it loads them here.
    // `reload()` renders from whatever the store already holds and syncs the delta
    // in the background, so a warm cache shows the form immediately.
    ;[outlets, skus, products, outletStorages, warehouseStorages].forEach((resource) => resource.reload())
  })

  const outletCode = computed(() => parent.record.value.OutletCode || '')
  // Falls back to the code so the header never renders an empty line while the
  // Outlets rows are still syncing.
  const outletName = computed(() => {
    const code = outletCode.value
    if (!code) return '—'
    return outlets.items.value.find((row) => row.Code === code)?.Name || code
  })

  // The ORIGINAL request date, shown read-only. `Edit/PageAction.js` overwrites
  // the field with today's date on submit, so this reads the pristine server
  // record rather than the node it is about to stamp.
  const restockDate = computed(() => serverRecord.value?.Date || parent.record.value.Date || '—')

  // The state the page was ENTERED in. Read from the pristine server record
  // because `Edit/PageAction.js` rewrites `Progress` on the node at submit time,
  // and both the header and `EditSubmitOptions` ask "why is this editable?" — a
  // question about how the request arrived here, not about what it is becoming.
  const progress = computed(() => String(serverRecord.value?.Progress || parent.record.value.Progress || '').trim())
  const isRevision = computed(() => progress.value === 'REVISION_REQUIRED')

  // Why the request came back. A workflow stamp, never edited here, so it is read
  // off the server record rather than the node the page is about to mutate.
  const revisionNote = computed(() => String(serverRecord.value?.ProgressRevisionRequiredComment || '').trim())

  // The comment that will ride along with the RESUBMISSION. Loaded onto the node
  // by `pageState.load`, so a previous submission's text is already there and is
  // overwritten intentionally rather than silently wiped.
  const comment = computed(() => parent.record.value.ProgressSubmittedComment || '')

  function setComment (value) {
    pageState.setRecord('ProgressSubmittedComment', value ?? '', PARENT)
  }

  return {
    // Relayed on so `EditSubmitOptions` — which already imports this file — can
    // read and write its `isDraft` control field without a second import (§6).
    pageState,
    parent,
    outletCode,
    outletName,
    restockDate,
    progress,
    isRevision,
    revisionNote,
    comment,
    setComment
  }
}
