<template>
  <!-- Loading state while resolution is in progress -->
  <div v-if="!ready" class="flex flex-center q-pa-md">
    <q-spinner-dots color="primary" size="32px" />
  </div>

  <!-- Resolved: render the matched action component with all merged props -->
  <component
    v-else-if="resolvedComponent"
    :is="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Fallback: no action component found for this context -->
  <div v-else class="flex flex-center q-pa-xl">
    <q-card flat bordered class="text-center q-pa-lg" style="max-width: 480px; width: 100%">
      <q-icon name="layers_clear" size="48px" color="warning" class="q-mb-sm" />
      <div class="text-subtitle1 text-weight-medium text-warning q-mb-xs">
        Action Not Defined
      </div>
      <div class="text-body2 text-grey-7">
        <strong>{{ props.action }}</strong> is not defined
        for page <strong>{{ preparedProps.page }}</strong>
        on resource <strong>{{ preparedProps.resource }}</strong>
        <span v-if="preparedProps.scope">
          (scope: <em>{{ preparedProps.scope }}</em>)
        </span>.
      </div>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useActionResolver } from 'src/composables/resources/useActionResolver'

defineOptions({ name: 'AqlAction', inheritAttrs: false })

const props = defineProps({
  action: { type: String, required: true },
  // Optional base component used when no file resolves for `action` — neither a
  // `components/actions/` base nor any `_ui/` candidate. Lets containers mount
  // dynamically-named actions (e.g. ResourceActions' per-item
  // `ResourceActionApprove`) against a generic base instead of the
  // "Action Not Defined" card, while keeping every `_ui/` tier able to override.
  fallback: { type: [Object, Function], default: null }
})

const attrs = useAttrs()

// Combine all orchestrator-supplied attributes with the explicit action identity.
// This single object is everything the resolver needs to perform its lookup.
// `fallback` is a declared prop, so it never leaks into the resolved props.
const preparedProps = computed(() => ({ ...attrs, action: props.action }))

const { ready, resolvedComponent, finalProps } = useActionResolver(preparedProps, props.fallback)
</script>
