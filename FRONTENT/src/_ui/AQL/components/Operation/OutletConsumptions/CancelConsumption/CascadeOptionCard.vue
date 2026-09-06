<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section>
      <div class="row items-center no-wrap q-col-gutter-sm">
        <div class="col-auto">
          <q-icon :name="option.icon" size="sm" :color="option.exists ? 'primary' : 'grey-5'" />
        </div>
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">{{ option.label }}</div>
          <div class="text-caption text-grey-8">{{ option.message }}</div>
        </div>
        <div class="col-auto">
          <q-toggle v-model="checked" :disable="!option.cancellable" color="negative" />
        </div>
      </div>

      <q-btn
        v-if="showLink"
        flat
        dense
        no-caps
        color="primary"
        icon="open_in_new"
        class="q-mt-sm"
        :label="`Open ${option.linkCode}`"
        @click="open"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
// One connected resource, one decision. Every verdict on the card — whether it exists,
// whether it may still be cancelled, what to say — is read off the Layer 2 option.
// No `<style>` block (ARCHITECTURE RULES §7).
import { computed } from 'vue'
import { useConsumptionCancelContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/CancelConsumption/useConsumptionCancelContext'

defineOptions({ name: 'OutletConsumptionsCascadeOptionCard', inheritAttrs: false })

const props = defineProps({
  option: { type: Object, required: true },
  control: { type: String, required: true },
  node: { type: String, default: '' }
})

const { pageState, ui, nav } = useConsumptionCancelContext()

const checked = pageState.useControls(props.control, false, props.node)

// Only worth offering when the leg exists AND this page cannot act on it.
const showLink = computed(() => props.option.exists && !props.option.cancellable && !!props.option.linkCode)

const open = () => nav.goTo('view', {
  scope: 'operation',
  resourceSlug: props.option.slug,
  code: props.option.linkCode
})
</script>
