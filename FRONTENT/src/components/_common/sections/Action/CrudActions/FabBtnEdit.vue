<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @edit="$emit('edit')"
  />
  <q-btn
    v-else
    round
    unelevated
    :color="finalProps.color"
    class="fab-btn"
    @click="$emit('edit')"
  >
    <q-icon :name="finalProps.icon" size="24px" />
    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 8]">
      {{ finalProps.tooltip }}
    </q-tooltip>
  </q-btn>
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'CrudActionsFabBtnEdit' })

const props = defineProps({
  permissions: { type: Object, required: true },
  page: { type: String, required: true },
  color: { type: String, default: 'primary' },
  icon: { type: String, default: 'edit' },
  tooltip: { type: String, default: 'Edit' }
})

defineEmits(['edit'])

const preparedProps = computed(() => ({
  permissions: props.permissions,
  color: props.color,
  icon: props.icon,
  tooltip: props.tooltip
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'CrudActionsFabBtnEdit',
  page: props.page,
  preparedProps
})
</script>

<style scoped>
.fab-btn {
  width: 56px;
  height: 56px;
  box-shadow: 0 8px 24px rgba(15, 43, 74, 0.3);
  background: linear-gradient(145deg, var(--q-primary), var(--q-primary-dark, #1565c0));
  transition: transform 180ms ease;
}
.fab-btn:active {
  transform: scale(0.95);
}
</style>
