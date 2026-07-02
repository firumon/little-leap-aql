<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @click="$emit('click')"
  />
  <q-btn
    v-else
    round
    unelevated
    :color="resolvedColor"
    class="fab-btn"
    @click="$emit('click')"
  >
    <q-icon :name="resolvedIcon" size="24px" />
    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 8]">
      {{ resolvedLabel }}
    </q-tooltip>
  </q-btn>
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'AdditionalActionsFabSingleBtn' })

const props = defineProps({
  action: { type: Object, required: true },
  page: { type: String, required: true },
  color: { type: [String, Function], default: 'primary' },
  icon: { type: [String, Function], default: 'bolt' },
  label: { type: [String, Function], default: '' }
})

defineEmits(['click'])

const preparedProps = computed(() => ({
  action: props.action,
  color: typeof props.color === 'function' ? props.color : (props.action.color || props.color),
  icon: typeof props.icon === 'function' ? props.icon : (props.action.icon || props.icon),
  label: typeof props.label === 'function' ? props.label : (props.action.label || props.action.action || props.label)
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'AdditionalActionsFabSingleBtn',
  page: props.page,
  preparedProps
})

const resolvedColor = computed(() => {
  const c = finalProps.value.color
  return typeof c === 'function' ? c(props.action) : c
})

const resolvedIcon = computed(() => {
  const i = finalProps.value.icon
  return typeof i === 'function' ? i(props.action) : i
})

const resolvedLabel = computed(() => {
  const l = finalProps.value.label
  return typeof l === 'function' ? l(props.action) : l
})
</script>

<style scoped>
.fab-btn {
  width: 56px;
  height: 56px;
  box-shadow: 0 8px 24px rgba(15, 43, 74, 0.3);
  transition: transform 180ms ease;
}
.fab-btn:active {
  transform: scale(0.95);
}
</style>
