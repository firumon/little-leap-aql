<template>
  <q-input
    v-bind="$attrs"
    :model-value="modelValue"
    @update:model-value="emitValue"
    mask="####-##-##"
    placeholder="YYYY-MM-DD"
  >
    <template v-slot:append>
      <q-icon name="event" class="cursor-pointer">
        <q-popup-proxy ref="qDateProxy" transition-show="scale" transition-hide="scale">
          <q-date
            :model-value="modelValue"
            @update:model-value="onDateSelect"
            mask="YYYY-MM-DD"
            minimal
          >
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])
const qDateProxy = ref(null)

function emitValue(val) {
  emit('update:modelValue', val)
}

function onDateSelect(val) {
  emit('update:modelValue', val)
  if (qDateProxy.value) {
    qDateProxy.value.hide()
  }
}
</script>
