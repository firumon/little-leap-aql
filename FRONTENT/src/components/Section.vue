<template>
  <!-- Mirrors Content.vue: one cross-fade for every section placeholder, so the
       spinner hands off to the resolved section instead of popping. Keys are what
       let Transition tell the three branches apart — the component's key is its
       section identity, so a placeholder that re-resolves also animates. -->
  <Transition name="aql-page-turn" mode="out-in">
    <!-- Loading state while resolution is in progress -->
    <div v-if="!ready" key="loading" class="flex flex-center q-pa-md">
      <q-spinner-dots color="primary" size="32px" />
    </div>

    <!-- Resolved: the wrapper carries the page's section padding, because
         inheritAttrs:false here (and in most section widgets) drops the class
         Page.vue puts on this placeholder. -->
    <div
      v-else-if="resolvedComponent"
      :key="preparedProps.section"
      :class="sectionWrapperClass"
    >
      <component :is="resolvedComponent" v-bind="finalProps" />
    </div>

    <!-- Fallback: no section component found for this context -->
    <div v-else key="fallback" class="flex flex-center q-pa-xl">
      <q-card flat bordered class="text-center q-pa-lg" style="max-width: 480px; width: 100%">
        <q-icon name="layers_clear" size="48px" color="warning" class="q-mb-sm" />
        <div class="text-subtitle1 text-weight-medium text-warning q-mb-xs">
          Section Not Defined
        </div>
        <div class="text-body2 text-grey-7">
          <strong>{{ props.section }}</strong> is not defined
          for page <strong>{{ preparedProps.page }}</strong>
          on resource <strong>{{ preparedProps.resource }}</strong>
          <span v-if="preparedProps.scope">
            (scope: <em>{{ preparedProps.scope }}</em>)
          </span>.
        </div>
      </q-card>
    </div>
  </Transition>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'AqlSection', inheritAttrs: false })

const props = defineProps({
  section: { type: String, required: true }
})

const attrs = useAttrs()

// Combine all orchestrator-supplied attributes with the explicit section identity.
// This single object is everything the resolver needs to perform its lookup.
const preparedProps = computed(() => ({ ...attrs, section: props.section }))

const { ready, resolvedComponent, finalProps } = useSectionResolver(preparedProps)

const sectionWrapperClass = computed(() => {
  const cfg = finalProps.value || {}
  const token = cfg.sectionPadding || cfg.padding
  const ignored = (cfg.ignorePadding || []).includes(props.section)
  return [
    token && !ignored ? `q-px-${token}` : null,
    cfg.sectionClass || null
  ].filter(Boolean)
})
</script>
