<template>
  <!-- One cross-fade for every content placeholder in the app: the spinner hands
       off to the resolved component (or the fallback card) instead of popping.
       `mode="out-in"` keeps the two states from overlapping while the outgoing
       one is still occupying layout. Keys are what let Transition tell the three
       branches apart — the component's key is its content identity, so a
       placeholder that re-resolves to a different content also animates. -->
  <Transition name="aql-page-turn" mode="out-in">
    <!-- Loading state while resolution is in progress -->
    <div v-if="!ready" key="loading" class="flex flex-center q-pa-md">
      <q-spinner-dots color="primary" size="32px" />
    </div>

    <!-- Resolved: render the matched content component with all merged props -->
    <component
      v-else-if="resolvedComponent"
      :is="resolvedComponent"
      :key="preparedProps.content"
      v-bind="finalProps"
    />

    <!-- Fallback: no content component found for this context -->
    <div v-else key="fallback" class="flex flex-center q-pa-xl">
      <q-card flat bordered class="text-center q-pa-lg" style="max-width: 480px; width: 100%">
        <q-icon name="layers_clear" size="48px" color="warning" class="q-mb-sm" />
        <div class="text-subtitle1 text-weight-medium text-warning q-mb-xs">
          Content Not Defined
        </div>
        <div class="text-body2 text-grey-7">
          <strong>{{ props.content }}</strong> is not defined
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
import { useContentResolver } from 'src/composables/resources/useContentResolver'

defineOptions({ name: 'AqlContent', inheritAttrs: false })

const props = defineProps({
  content: { type: String, required: true }
})

const attrs = useAttrs()

// Combine all orchestrator-supplied attributes with the explicit content identity.
// This single object is everything the resolver needs to perform its lookup.
const preparedProps = computed(() => ({ ...attrs, content: props.content }))

const { ready, resolvedComponent, finalProps } = useContentResolver(preparedProps)
</script>
