<template>
  <div v-if="!pending && summary.lines">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center q-gutter-xs">
          <q-chip dense square color="grey-3" text-color="grey-9" :label="`${summary.expected} expected`" />
          <q-chip dense square color="primary" text-color="white" :label="`${summary.received} received`" />
          <q-chip dense square color="positive" text-color="white" :label="`${summary.accepted} accepted`" />
          <q-chip v-if="summary.damaged" dense square color="orange" text-color="white" :label="`${summary.damaged} damaged`" />
          <q-chip v-if="summary.rejected" dense square color="negative" text-color="white" :label="`${summary.rejected} rejected`" />
          <q-chip v-if="summary.short" dense square color="warning" text-color="white" :label="`${summary.short} short`" />
          <q-chip v-if="summary.excess" dense square color="purple" text-color="white" :label="`${summary.excess} excess`" />
        </div>

        <q-separator class="q-my-sm" />

        <div class="text-caption text-grey-7">
          Accepted = received − damaged − rejected. Only accepted quantity reaches the goods receipt.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useReceivingView } from 'src/_ui/AQL/composables/Operation/POReceivings/View/useReceivingView'
import { useReceivingViewContext } from 'src/_ui/AQL/composables/Operation/POReceivings/View/useReceivingViewContext'

defineOptions({ name: 'POReceivingsViewInspectionSummary', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Inspection Summary' }
})

const { evaluate, ui } = useReceivingViewContext()
const { summary, pending } = useReceivingView()

const finalTitle = computed(() => evaluate(props.title))
</script>
