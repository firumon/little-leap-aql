<template>
  <div v-if="record && isMotherCompany && childOutlets.length > 0">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-list separator>
        <q-item
          v-for="child in childOutlets"
          :key="childOf(child)"
          clickable
          @click="openRecord('outlets', childOf(child), 'master')"
        >
          <q-item-section avatar>
            <q-avatar icon="storefront" color="primary" text-color="white" size="md" />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ nameOf(child) }}</q-item-label>
            <q-item-label caption>{{ captionOf(child) }}</q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-chip dense square :color="statusColor(child)" text-color="white" class="q-my-none">
              {{ statusOf(child) }}
            </q-chip>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Outlets › View › SubOutlets — Section (tier CP: resource + page).
 *
 * The outlets that roll up to this one when it heads a family. `OutletDetails` states the
 * fact in one line; this card is where the reader acts on it.
 *
 * ── THE WHOLE SECTION IS ABSENT, NOT EMPTY ──
 * A standalone outlet, and a mother with no sub-outlets, are the ordinary case. Showing a
 * titled card over an empty list would spend a heading to say nothing, so the guard is the
 * card's whole loading and empty state (§10.4).
 *
 * Membership comes from the shared index's `ParentOutletCode` map, read per family, so these
 * rows are the same children the family analytics count.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewSubOutlets', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Sub-Outlets' }
})

const {
  evaluate, ui, record, isMotherCompany, childOutlets, openRecord
} = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))

const text = (value) => (value == null ? '' : String(value).trim())

const childOf = (child) => text(child.Code || child.code)
const nameOf = (child) => text(child.Name || child.name) || 'Unnamed outlet'
const statusOf = (child) => text(child.status || child.Status) || 'Active'
const statusColor = (child) => (statusOf(child).toUpperCase() === 'ACTIVE' ? 'positive' : 'grey-6')

const captionOf = (child) =>
  [childOf(child), [child.Area, child.City].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
</script>
