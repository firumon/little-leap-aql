<template>
  <div class="row items-center justify-around q-px-sm q-my-md">
    <div
      v-for="s in steps" :key="s.name"
      class="column items-center" :class="clickable ? 'cursor-pointer' : ''"
      style="min-width: 72px"
      @click="handleStepClick(s)"
    >
      <q-avatar
        :size="modelValue >= s.name ? '36px' : '32px'"
        :color="modelValue >= s.name ? activeColor : inactiveColor"
        :text-color="modelValue >= s.name ? activeTextColor : inactiveTextColor"
        :class="modelValue === s.name ? 'shadow-3' : ''"
      >
        <q-icon v-if="modelValue > s.name" name="check" size="18px" />
        <span v-else-if="!s.icon" class="text-subtitle2 text-weight-bold">{{ s.name }}</span>
        <q-icon v-else :name="s.icon" size="18px" />
      </q-avatar>
      <div
        class="text-caption q-mt-xs text-center"
        :class="modelValue >= s.name ? `text-weight-bold text-${activeColor}` : `text-${inactiveTextColor}`"
      >
        {{ s.label }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'StepProgressIndicator' })

const props = defineProps({
  modelValue: {
    type: [Number, String],
    required: true
  },
  steps: {
    type: Array,
    required: true
  },
  clickable: {
    type: Boolean,
    default: false
  },
  activeColor: {
    type: String,
    default: 'primary'
  },
  inactiveColor: {
    type: String,
    default: 'grey-4'
  },
  activeTextColor: {
    type: String,
    default: 'white'
  },
  inactiveTextColor: {
    type: String,
    default: 'grey-7'
  }
})

const emit = defineEmits(['update:modelValue', 'click-step'])

function handleStepClick(targetStep) {
  if (!props.clickable) return
  emit('click-step', targetStep.name)
}
</script>
