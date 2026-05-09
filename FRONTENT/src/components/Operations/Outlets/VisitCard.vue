<template>
  <q-card
    flat
    bordered
    class="visit-card"
    :class="[urgencyClass, urgencyBgClass]"
  >
    <q-card-section class="row items-start no-wrap visit-card__content q-pa-md">
      <q-icon name="event_available" :color="urgencyColor" size="sm" class="q-mt-xs" />

      <div class="col min-width-0">
        <div class="text-subtitle2 ellipsis">{{ outletLabel(visit.OutletCode) }}</div>
        <div class="text-caption" :class="urgencyDateClass">{{ dateLine }}</div>
      </div>

      <div v-if="showQuickActions" class="visit-card__actions">
        <q-btn-dropdown
          outline
          color="primary"
          label="Actions"
          size="sm"
        >
          <q-list dense>
            <q-item clickable v-close-popup @click.stop="$emit('complete', visit)">
              <q-item-section avatar><q-icon name="check_circle" color="positive" /></q-item-section>
              <q-item-section>Complete</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click.stop="$emit('postpone', visit)">
              <q-item-section avatar><q-icon name="schedule" color="warning" /></q-item-section>
              <q-item-section>Postpone</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click.stop="$emit('cancel', visit)">
              <q-item-section avatar><q-icon name="cancel" color="negative" /></q-item-section>
              <q-item-section>Cancel</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>

      <div v-else class="visit-card__chip">
        <OutletProgressChip :progress="visitProgress(visit)" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useOutletVisits } from '../../../composables/operations/outlets/useOutletVisits.js'
import OutletProgressChip from './OutletProgressChip.vue'

defineOptions({ name: 'VisitCard' })

const props = defineProps({
  visit: { type: Object, required: true },
  showActions: { type: Boolean, default: false }
})

defineEmits(['complete', 'postpone', 'cancel'])

const { outletLabel, visitUrgency, visitProgress, visitDateDisplay } = useOutletVisits()

const isPlanned = computed(() => visitProgress(props.visit) === 'PLANNED')
const showQuickActions = computed(() => props.showActions && isPlanned.value)

const urgencyClass = computed(() => `visit-card--${visitUrgency(props.visit)}`)
const urgencyColor = computed(() => {
  const urgency = visitUrgency(props.visit)
  if (urgency === 'overdue') return 'negative'
  if (urgency === 'today') return 'primary'
  return 'grey'
})

const urgencyBgClass = computed(() => {
  if (visitUrgency(props.visit) === 'overdue') return 'bg-red-1'
  if (visitUrgency(props.visit) === 'today') return 'bg-blue-1'
  return ''
})

const urgencyDateClass = computed(() => {
  const urgency = visitUrgency(props.visit)
  if (urgency === 'overdue') return 'text-negative'
  if (urgency === 'today') return 'text-primary'
  return 'text-grey-7'
})

const display = computed(() => visitDateDisplay(props.visit))

const dateLine = computed(() => {
  const d = display.value
  if (d.relative && d.absolute) return `${d.relative} · ${d.absolute}`
  if (d.absolute) return d.absolute
  return 'No date'
})

</script>

<style scoped>
.visit-card {
  border-left: 4px solid var(--q-grey-5);
  border-radius: 8px;
  max-width: 100%;
}

.visit-card--overdue {
  border-left-color: var(--q-negative);
}

.visit-card--today {
  border-left-color: var(--q-primary);
}

.visit-card--neutral {
  border-left-color: var(--q-grey-5);
}

.min-width-0 {
  min-width: 0;
}

.visit-card__content {
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

.visit-card__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.visit-card__chip {
  display: flex;
  flex: 0 1 auto;
  justify-content: flex-end;
  max-width: 42%;
  min-width: 0;
}

.visit-card__chip :deep(.q-chip) {
  max-width: 100%;
}

.visit-card__chip :deep(.q-chip__content) {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 399px) {
  .visit-card__content {
    flex-wrap: wrap;
  }

  .visit-card__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
