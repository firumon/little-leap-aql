<template>
  <div v-if="record">
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
                :class="[line.clickable ? 'cursor-pointer' : '', 'q-my-none']"
                @click="onLineClick(line)"
              >
                <q-icon v-if="line.icon" :name="line.icon" class="q-mr-xs" />
                {{ line.value }}
              </q-chip>
              <span
                v-else
                :class="line.clickable ? 'cursor-pointer text-primary' : ''"
                @click="onLineClick(line)"
              >{{ line.value }}</span>
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
 * No `<style>` block — `.aql-detail-*` are the canonical shared classes
 * (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewOutletDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Outlet' }
})

const {
  evaluate, ui, pending, record, summary, activityColor, activityLabel,
  isMotherCompany, childOutlets, parentCode, parentOutletName, openRecord
} = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

const text = (value) => (value == null ? '' : String(value).trim())

/** Only a line that opted in is a link; the rest must stay inert on tap. */
const onLineClick = (line) => { if (line.clickable) line.onClick?.() }

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

  // ── Where this outlet sits in its family ──
  // The two are mutually exclusive by construction: heading a family and belonging to one
  // cannot both be true, so a reader is never shown two statements about the same question.
  const family = []
  if (isMotherCompany.value) {
    family.push({
      label: 'Organization',
      value: `Mother Company (${childOutlets.value.length} sub-outlets)`,
      chip: true,
      color: 'primary',
      icon: 'hub'
    })
  }
  if (parentCode.value) {
    family.push({
      label: 'Parent Company',
      value: parentOutletName.value,
      clickable: true,
      onClick: () => openRecord('outlets', parentCode.value, 'master')
    })
  }

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

  return [...identity, ...family, ...optional, ...state]
})
</script>
