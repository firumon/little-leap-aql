<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" position="bottom">
    <q-card class="q-pa-md" style="border-radius: 16px 16px 0 0; max-width: 500px; margin: 0 auto; width: 100%;">
      <q-card-section class="q-pb-none row items-center justify-between no-wrap">
        <div class="text-subtitle1 text-weight-bold text-grey-9">{{ outletLabel || '' }}</div>
        <q-btn flat round dense icon="close" v-close-popup @click="emit('cancel')" />
      </q-card-section>

      <q-card-section class="q-py-md column q-gutter-y-sm">
        <div class="text-caption text-grey-6">Select action:</div>

        <div class="column q-gutter-y-sm q-mb-md">
          <q-item
            clickable
            v-ripple
            @click="chosenAction = 'complete'"
            :class="{ 'bg-green-1 text-green-9': chosenAction === 'complete' }"
            :style="{
              border: '1px solid',
              borderColor: chosenAction === 'complete' ? '#21ba45' : '#e2e8f0',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }"
            class="q-pa-sm"
          >
            <q-item-section avatar>
              <q-icon name="check_circle" :color="chosenAction === 'complete' ? 'positive' : 'grey-6'" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold text-subtitle2">Complete Visit</q-item-label>
              <q-item-label caption :class="{ 'text-green-8': chosenAction === 'complete' }">
                Mark this planned visit as completed
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            clickable
            v-ripple
            @click="chosenAction = 'postpone'"
            :class="{ 'bg-orange-1 text-orange-9': chosenAction === 'postpone' }"
            :style="{
              border: '1px solid',
              borderColor: chosenAction === 'postpone' ? '#f2c037' : '#e2e8f0',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }"
            class="q-pa-sm"
          >
            <q-item-section avatar>
              <q-icon name="schedule" :color="chosenAction === 'postpone' ? 'warning' : 'grey-6'" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold text-subtitle2">Postpone / Reschedule</q-item-label>
              <q-item-label caption :class="{ 'text-orange-8': chosenAction === 'postpone' }">
                Reschedule planned visit to another day
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-item
            clickable
            v-ripple
            @click="chosenAction = 'cancel'"
            :class="{ 'bg-red-1 text-red-9': chosenAction === 'cancel' }"
            :style="{
              border: '1px solid',
              borderColor: chosenAction === 'cancel' ? '#c10015' : '#e2e8f0',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }"
            class="q-pa-sm"
          >
            <q-item-section avatar>
              <q-icon name="cancel" :color="chosenAction === 'cancel' ? 'negative' : 'grey-6'" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold text-subtitle2">Cancel Visit</q-item-label>
              <q-item-label caption :class="{ 'text-red-8': chosenAction === 'cancel' }">
                Cancel this planned visit entirely
              </q-item-label>
            </q-item-section>
          </q-item>
        </div>

        <div v-if="chosenAction === 'complete'" class="column q-gutter-y-sm">
          <q-input v-model="actionForm.comment" label="Comment (optional)" outlined type="textarea" />
        </div>

        <div v-else-if="chosenAction === 'postpone'" class="column q-gutter-y-sm">
          <AppDate v-model="actionForm.date" label="New Date" outlined dense hide-bottom-space />
          <q-input v-model="actionForm.reason" label="Reason (mandatory)" outlined type="textarea" />
        </div>

        <div v-else-if="chosenAction === 'cancel'" class="column q-gutter-y-sm">
          <AppDate v-model="actionForm.nextDate" label="Next Visit Date (optional)" outlined dense clearable hide-bottom-space />
          <q-input v-model="actionForm.reason" label="Reason (mandatory)" outlined type="textarea" />
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup @click="emit('cancel')" />
        <q-btn
          :label="chosenAction === 'complete' ? 'Complete Visit' : chosenAction === 'postpone' ? 'Postpone' : 'Cancel Visit'"
          :color="chosenAction === 'complete' ? 'positive' : chosenAction === 'postpone' ? 'warning' : 'negative'"
          :loading="saving"
          :disable="isSubmitDisabled"
          @click="handleConfirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import AppDate from '../../shared/AppDate.vue'

defineOptions({ name: 'OutletVisitActionDialog' })

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  visit: { type: Object, default: () => null },
  outletLabel: { type: String, default: '' },
  saving: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const chosenAction = ref('complete')
const actionForm = ref({ date: '', reason: '', nextDate: '', comment: '' })

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    chosenAction.value = 'complete'
    actionForm.value = { date: '', reason: '', nextDate: '', comment: '' }
  }
})

const isSubmitDisabled = computed(() => {
  if (props.saving) return true
  if (chosenAction.value === 'postpone' && (!actionForm.value.date || !actionForm.value.reason?.trim())) return true
  if (chosenAction.value === 'cancel' && !actionForm.value.reason?.trim()) return true
  return false
})

function handleConfirm() {
  if (isSubmitDisabled.value) return
  emit('confirm', { action: chosenAction.value, fields: { ...actionForm.value } })
}
</script>
