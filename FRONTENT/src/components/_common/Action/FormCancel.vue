<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @cancel="$emit('cancel')"
  />
  <q-btn
    v-else
    flat
    color="grey-7"
    label="Cancel"
    icon="close"
    @click="$emit('cancel')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'FormCancel' })

const props = defineProps({
  page: { type: String, default: 'Add' }
})

defineEmits(['cancel'])

const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'FormCancel',
  page: props.page
})

const preparedProps = computed(() => ({}))
const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
