<template>
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  >
    <slot />
  </component>
  <div v-else class="form-actions-sticky-spacer">
    <div class="form-actions-sticky-bar">
      <div class="form-actions-content row items-center justify-end q-gutter-sm">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'FormActionsStickyBar' })

const props = defineProps({
  page: { type: String, required: true }
})

const preparedProps = computed(() => ({}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'FormActionsStickyBar',
  page: props.page,
  preparedProps
})
</script>

<style scoped>
.form-actions-sticky-spacer {
  height: 80px;
}

.form-actions-sticky-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--aql-border, rgba(0, 0, 0, 0.08));
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.03);
}

.form-actions-content {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
