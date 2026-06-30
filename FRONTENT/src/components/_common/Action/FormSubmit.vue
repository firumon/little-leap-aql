<template>
  <component
    :is="resolvedComponent"
    v-slot="{ label, saving }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @submit="$emit('submit')"
  />
  <q-btn
    v-else
    type="submit"
    :label="finalProps.label"
    :loading="finalProps.saving"
    color="primary"
    unelevated
    icon="save"
    @click="$emit('submit')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'FormSubmit' })

const props = defineProps({
  label: { type: String, default: 'Save' },
  saving: { type: Boolean, default: false },
  page: { type: String, default: 'Add' }
})

defineEmits(['submit'])

const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'FormSubmit',
  page: props.page
})

const preparedProps = computed(() => ({
  label: props.label,
  saving: props.saving
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
