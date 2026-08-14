<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel :label="title" />

    <q-card v-if="!productGroups.length" flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="inventory_2" size="40px" color="grey-4" class="q-mb-sm block q-mx-auto" />
        <div class="text-subtitle1 text-weight-bold text-grey-6">Nothing selected</div>
        <div class="text-caption text-grey-6">Go back and pick the items that arrived.</div>
      </q-card-section>
    </q-card>

    <!-- The selection re-rendered, in the SAME Product → SKU → storage grouping
         step 1 used. Read-only throughout: the decision is made beside the rows
         it applies to, and restating it as an editable control here would let the
         same tick be changed in two places. -->
    <q-card
      v-for="(product, index) in productGroups"
      :key="product.productCode"
      flat
      bordered
      class="page-card aql-premium-gradient-card"
      :style="rowDelay(index)"
    >
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col aql-flex-wrap-text">
            <div class="text-subtitle1 text-weight-bold">{{ product.productName }}</div>
          </div>
          <div class="col-auto text-subtitle1 text-weight-bold text-positive">
            {{ product.selectedQuantity }} {{ product.uom }}
          </div>
        </div>

        <q-separator />

        <div v-for="group in product.skus" :key="group.key" class="q-mt-sm">
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col aql-flex-wrap-text text-body2 text-weight-medium">{{ group.label }}</div>
            <div class="col-auto text-body2 text-weight-medium text-grey-7">
              {{ group.selectedQuantity }} {{ group.uom }}
            </div>
          </div>

          <div class="aql-detail-grid q-ml-sm">
            <div v-for="row in group.rows" :key="row.code" class="aql-detail-line items-center">
              <span class="aql-detail-key">{{ row.warehouseCode || '—' }} | {{ row.storageName }}</span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                {{ row.quantity }} {{ row.uom }}
              </span>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="productGroups.length" flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <div class="aql-detail-grid">
          <div
            v-for="(line, index) in totalsLines"
            :key="line.key"
            class="aql-detail-line items-center aql-detail-row"
            :style="rowDelay(index)"
          >
            <span class="aql-detail-key">{{ line.key }}</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- The GRN note. Deliberately optional: a clean delivery has nothing to say
         about it, and forcing a sentence would only produce filler that makes the
         genuinely noteworthy ones harder to spot. -->
    <SectionDividerLabel :label="commentTitle" />

    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <component
          :is="CommentField"
          :model-value="comment"
          :record="restock"
          :config="commentConfig"
          header="ProgressDeliveredComment"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 2 of Mark As Delivered: confirm what arrived, and note anything about it.
 *
 * Read-only over the selection — it reuses `useRestockDelivery`'s projection
 * rather than recomputing anything, so the rows and totals here are the same
 * arithmetic step 1 showed and cannot drift from what
 * `MarkDelivered/PageAction.js` submits (ARCHITECTURE RULES §6).
 *
 * The GRN note is the one input on this step. It is stored as a CONTROL field,
 * not a record field, so it never leaks into a payload on its own — the sticky
 * bar's handler places it on the right columns for the outcome
 * (UI_PAGE_STATE.md §6.4).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'components/_fields/useFieldResolver'
import { useRestockDelivery } from 'src/_ui/AQL/composables/Operation/OutletRestocks/MarkDelivered/useRestockDelivery'
import { useRestockDeliveryContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/MarkDelivered/useRestockDeliveryContext'

defineOptions({ name: 'OutletRestocksMarkDeliveredReviewDelivery', inheritAttrs: false })

const ROW_STAGGER_MS = 40

// Hoisted to a module constant: an object literal inline in the template is a new
// prop identity on every render, for a value that never changes.
const COMMENT_CONFIG = {
  label: 'GRN / delivery note',
  hint: 'Optional. Recorded against this delivery.',
  hideBottomSpace: false,
  'data-testid': 'restock-delivery-comment'
}

const props = defineProps({
  step: { type: Number, default: 2 },
  title: { type: [String, Function], default: 'Confirming Delivery' },
  commentTitle: { type: [String, Function], default: 'Delivery Note' }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, evaluate } = useRestockDeliveryContext()

const {
  restock,
  productGroups: allGroups,
  selectedCount,
  selectedQuantity,
  selectedUom,
  comment,
  setComment
} = useRestockDelivery()

const visible = computed(() => pageState?.meta.currentStep === props.step)

const title = computed(() => evaluate(props.title) || '')
const commentTitle = computed(() => evaluate(props.commentTitle) || '')

// Resolved through the field registry rather than a direct `q-input`, so the note
// box picks up whatever the shared textarea control does
// (UI_MODULE_DEVELOPER_GUIDE.md §2.3). Synchronous — the registry is built eagerly, so the
// control never flashes an empty cell while a chunk loads.
const CommentField = resolveFieldComponent('textarea', 'edit')
const commentConfig = computed(() => COMMENT_CONFIG)

/**
 * The step-1 tree, narrowed to what was actually ticked.
 *
 * Filtered, never rebuilt and never spread from an enriched record: the same
 * group objects the selection step rendered are reused, with their unselected
 * branches dropped. A second grouping pass here would be a second source of
 * truth about what is being submitted.
 */
const productGroups = computed(() => allGroups.value
  .filter((product) => product.someSelected)
  .map((product) => ({
    ...product,
    skus: product.skus
      .filter((group) => group.someSelected)
      .map((group) => ({ ...group, rows: group.rows.filter((row) => row.selected) }))
  })))

const binCount = computed(() => productGroups.value
  .reduce((sum, product) => sum + product.skus.reduce((inner, group) => inner + group.rows.length, 0), 0))

const totalsLines = computed(() => [
  { key: 'Items delivered', value: String(selectedCount.value) },
  { key: 'Total quantity', value: `${selectedQuantity.value} ${selectedUom.value}`.trim() },
  { key: 'Source locations', value: String(binCount.value) }
])

const rowDelay = (index) => ({ animationDelay: `${index * ROW_STAGGER_MS}ms` })
</script>
