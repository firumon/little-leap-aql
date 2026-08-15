<template>
  <div :class="paddingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card v-if="pending" flat bordered :class="ui.cardClass">
      <q-card-section>
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>
    </q-card>

    <q-card v-else-if="!groups.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="warehouse" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing to allocate</div>
      </q-card-section>
    </q-card>

    <!-- One card per product, so the rhythm BETWEEN them is this container's, not a
         margin baked into each card. `gutter` is fed from `pageProps.gutter`, so
         these cards space themselves exactly as the page's Sections and Contents do. -->
    <div v-else :class="spacingClass">
      <!-- Before approval there is no stock behind any line, so a warehouse column
           would be an empty promise. The card states only where each SKU stands. -->
      <q-banner v-if="!approved" dense rounded class="bg-grey-2 text-grey-8">
        <template #avatar><q-icon name="schedule" color="warning" /></template>
        Stock is allocated once this request is approved.
      </q-banner>

      <q-card
        v-for="(product, index) in groups"
        :key="product.productCode"
        flat
        bordered
        :class="ui.cardClass"
        :style="rowDelay(index)"
      >
        <q-card-section>
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle1 text-weight-bold">{{ product.productName }}</div>
            </div>
            <div class="col-auto text-subtitle1 text-weight-bold text-primary">
              {{ product.quantity }} {{ product.uom }}
            </div>
          </div>

          <q-separator />

          <div v-for="group in product.skus" :key="group.key" class="q-mt-sm">
            <div class="row items-center no-wrap q-col-gutter-sm">
              <div class="col text-body2 text-weight-medium" :class="ui.flexWrapTextClass">{{ group.label }}</div>
              <div class="col-auto row items-center no-wrap q-gutter-x-xs">
                <q-badge
                  v-for="state in group.states"
                  :key="state"
                  rounded
                  :color="progressColor(state)"
                  :label="progressLabel(state)"
                />
              </div>
            </div>

            <!-- Approved: one line per bin the units are drawn from. Unapproved:
                 the SKU's own quantity, because there is no bin to name yet. -->
            <div class="q-ml-sm" :class="ui.detailGridClass">
              <template v-if="approved">
                <div v-for="row in group.rows" :key="row.code" class="items-center" :class="ui.detailLineClass">
                  <span :class="ui.detailKeyClass">
                    <q-icon :name="progressIcon(row.progress)" size="14px" :color="progressColor(row.progress)" class="q-mr-xs" />
                    {{ binLabel(row) }}
                  </span>
                  <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
                    {{ row.quantity }} {{ row.uom }}
                  </span>
                </div>
              </template>

              <div v-else class="items-center" :class="ui.detailLineClass">
                <span :class="ui.detailKeyClass">Requested</span>
                <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
                  {{ group.quantity }} {{ group.uom }}
                </span>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
/**
 * OutletRestocks › View › AllocationDetails — Section (tier 1: resource + page).
 *
 * Where each requested SKU is coming from. What that means depends entirely on
 * whether the request has been approved:
 *   unapproved → nothing has been committed, so each SKU shows only its state;
 *   approved   → each SKU shows the bins it draws from, and what each one gave.
 * The split is `useRestockView().approved`, never a Progress comparison written
 * here — the definition of "approved" is a domain rule and lives in one place.
 *
 * Renders the SAME `productGroups` tree `Items` reads, filtered by nothing, so the
 * two cards cannot disagree about what was requested (ARCHITECTURE RULES §6).
 *
 * Layout follows `MarkDelivered/ReviewDelivery.vue` — the same Product → SKU → bin
 * card, so a restock reads identically wherever its bins are shown.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { isApproved, useRestockView } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockView'
import { useRestockViewContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockViewContext'

defineOptions({ name: 'OutletRestocksViewAllocationDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Allocation Details' },
  // The Product → SKU tree to render. Defaults to the request's own items.
  items: { type: Array, default: null },
  // The request itself. Defaults to the injected record; supplied only when a
  // caller renders this card against something other than the page's own record.
  record: { type: Object, default: null },
  padding: { type: String, default: 'sm' },
  // Vertical rhythm between the product cards, as a Quasar spacing token. Fed from
  // `pageProps.gutter` by the page contract so one setting spaces the whole page.
  gutter: { type: String, default: 'xs' }
})

const { evaluate, ui } = useRestockViewContext()

const {
  productGroups, pending, approved: recordApproved,
  progressColor, progressIcon, progressLabel
} = useRestockView()

const paddingClass = computed(() => `q-px-${props.padding}`)
const spacingClass = computed(() => `q-gutter-y-${props.gutter}`)
const finalTitle = computed(() => evaluate(props.title))

const groups = computed(() => (Array.isArray(props.items) ? props.items : productGroups.value))
const approved = computed(() => (props.record ? isApproved(props.record) : recordApproved.value))

// A PENDING remainder carries no warehouse, so it names itself rather than
// rendering as an empty bin the reader would have to interpret.
function binLabel (row) {
  if (!row.warehouseCode) return progressLabel(row.progress)
  return `${row.warehouseName || row.warehouseCode} | ${row.storageName}`
}

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
