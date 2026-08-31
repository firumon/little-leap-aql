<template>
  <div v-if="!pending && terms.length">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in terms"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRFQView } from 'src/_ui/AQL/composables/Operation/RFQs/View/useRFQView'
import { useRFQViewContext } from 'src/_ui/AQL/composables/Operation/RFQs/View/useRFQViewContext'

defineOptions({ name: 'RFQsViewTerms', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Commercial Terms' }
})

const { evaluate, ui } = useRFQViewContext()
const { terms, pending } = useRFQView()

const finalTitle = computed(() => evaluate(props.title))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
