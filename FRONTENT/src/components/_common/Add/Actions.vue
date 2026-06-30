<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @cancel="$emit('cancel')"
    @submit="$emit('submit')"
  />

  <div v-else class="add-actions flex justify-end q-gutter-x-sm q-py-md q-px-sm">
    <!-- Cancel button -->
    <FormCancel :page="page" @cancel="$emit('cancel')" />

    <!-- Submit button -->
    <FormSubmit
      :page="page"
      :label="finalProps.submitLabel"
      :saving="finalProps.saving"
      @submit="$emit('submit')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import FormSubmit from 'components/_common/Action/FormSubmit.vue'
import FormCancel from 'components/_common/Action/FormCancel.vue'

defineOptions({ name: 'AddActions' })

const props = defineProps({
  submitLabel: { type: String, default: 'Create' },
  saving: { type: Boolean, default: false },
  page: { type: String, default: 'Add' }
})

defineEmits(['cancel', 'submit'])

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Actions',
  page: props.page
})

const preparedProps = computed(() => ({
  submitLabel: props.submitLabel,
  saving: props.saving
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
