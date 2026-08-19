<template>
  <div v-if="record" :class="paddingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="45%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else class="q-py-sm">
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, i) in lines"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(i)"
          >
            <div :class="ui.detailKeyClass">{{ line.label }}</div>
            <div :class="ui.detailValClass">
              <q-chip
                v-if="line.chip"
                dense square
                :color="line.color"
                text-color="white"
                class="q-my-none"
              >
                {{ line.value }}
              </q-chip>
              <span v-else>{{ line.value }}</span>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Outlets › View › OutletDetails — Section (tier CP: resource + page).
 *
 * The identity card: who this outlet is, where it is, and how to reach it — plus the one
 * derived fact that belongs beside the name rather than three cards further down, which is
 * how long the outlet has been silent.
 *
 * ── BLANK ROWS ARE DROPPED, NOT PADDED ──
 * A `Contact: —` row states nothing while looking like it does (§7.4). The two facts that
 * IDENTIFY the record — its code and its name — are shown even when unresolved; everything
 * else appears only when the sheet actually holds it.
 *
 * The activity chip is painted from the domain's own band table, so the colour here and the
 * colour on that outlet's row in the Index list are one scale (§4.5).
 *
 * Sections render outside `AqlContentWrapper`, so this card owns its own loading state and
 * hides entirely when no record resolves (§9.1, §10.4).
 *
 * ── SPACING COMES FROM THE PAGE, THROUGH THE `padding` PROP ──
 * `Page.vue` puts `q-px-{pageProps.sectionPadding}` on the placeholder AND passes the same
 * token as a `:padding` prop. Only the prop reaches this component: `inheritAttrs: false`
 * (§12.1, mandatory on the leaf the resolver mounts) drops the class along with the rest of
 * `$attrs`. So the inset is applied from the declared prop — the sanctioned channel for a
 * section's horizontal inset (§7.5, §10.2). Vertical rhythm stays the page body's gutter.
 *
 * No `<style>` block — `.aql-detail-*` are the canonical shared classes
 * (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewOutletDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Outlet' },
  // Horizontal inset, supplied by `Page.vue` as `:padding="pageProps.sectionPadding"`.
  //
  // Needed because this component sets `inheritAttrs: false` (§12.1 — it is the leaf the
  // resolver mounts), which DROPS the `q-px-{sectionPadding}` class `Page.vue` also puts on
  // the placeholder. The framework passes the same token as a real PROP for exactly this
  // case: a declared `padding` prop is the sanctioned channel for a section's horizontal
  // inset (§7.5, §10.2) and the only one that survives a leaf. Vertical rhythm still belongs
  // to the page body's gutter.
  padding: { type: String, default: 'sm' }
})

const {
  evaluate, ui, pending, record, summary, activityColor, activityLabel
} = useOutletViewContext()

const paddingClass = computed(() => (props.padding ? `q-px-${props.padding}` : ''))
const finalTitle = computed(() => evaluate(props.title))
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

const text = (value) => (value == null ? '' : String(value).trim())

const location = computed(() =>
  [record.value?.area, record.value?.city, record.value?.province, record.value?.country]
    .map(text).filter(Boolean).join(', '))

const lines = computed(() => {
  const outlet = record.value
  if (!outlet) return []

  const days = summary.value?.lastActivityDays ?? null

  // The two identity rows are unconditional; everything after them is filtered on content.
  const identity = [
    { label: 'Code', value: text(outlet.code) || '—' },
    { label: 'Name', value: text(outlet.name) || 'Unnamed outlet' }
  ]

  const optional = [
    { label: 'Contact', value: text(outlet.contactPerson) },
    { label: 'Phone', value: text(outlet.phone) },
    { label: 'Email', value: text(outlet.email) },
    { label: 'Location', value: location.value },
    { label: 'Address', value: text(outlet.communicationAddress) },
    { label: 'Tax registration', value: text(outlet.taxRegistrationNumber) }
  ].filter((line) => !!line.value)

  const state = [
    {
      label: 'Status',
      value: text(outlet.status) || 'Active',
      chip: true,
      color: text(outlet.status).toUpperCase() === 'ACTIVE' ? 'positive' : 'grey-6'
    },
    {
      label: 'Last activity',
      value: activityLabel(days),
      chip: true,
      color: activityColor(days)
    }
  ]

  return [...identity, ...optional, ...state]
})
</script>
