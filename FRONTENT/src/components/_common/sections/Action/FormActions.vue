<template>
  <component
    :is="resolvedComponent"
    v-slot="{ page, submitLabel, saving, disabled }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @cancel="$emit('cancel')"
    @submit="$emit('submit')"
  />

  <template v-else>
    <StickyBar :page="page">
      <FormCancel :page="page" @cancel="$emit('cancel')" />
      <FormSubmit
        :page="page"
        :label="submitLabel"
        :saving="saving"
        :disabled="disabled"
        @submit="$emit('submit')"
      />
    </StickyBar>
  </template>
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

import StickyBar from 'components/_common/sections/Action/FormActions/StickyBar.vue'
import FormCancel from 'components/_common/sections/Action/FormActions/FormCancel.vue'
import FormSubmit from 'components/_common/sections/Action/FormActions/FormSubmit.vue'

defineOptions({ name: 'FormActionsBar' })

const props = defineProps({
  page: { type: String, default: 'Add' },
  submitLabel: { type: String, default: 'Save' },
  saving: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

defineEmits(['cancel', 'submit'])

const preparedProps = computed(() => ({
  page: props.page,
  submitLabel: props.submitLabel,
  saving: props.saving,
  disabled: props.disabled
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'FormActions',
  page: props.page,
  preparedProps
})
</script>
