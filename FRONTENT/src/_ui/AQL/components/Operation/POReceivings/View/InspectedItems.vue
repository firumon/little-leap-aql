<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="50%" class="q-mb-sm" />
        <q-skeleton type="text" width="90%" />
      </q-card-section>

      <q-card-section v-else-if="!rows.length" class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No lines counted</div>
        <div :class="ui.emptyCaptionClass">Nothing has been inspected on this receiving yet.</div>
      </q-card-section>

      <q-card-section v-else>
        <div v-for="(line, index) in rows" :key="line.code" :class="ui.detailRowClass" :style="rowDelay(index)">
          <div class="row items-start no-wrap q-mb-xs">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-body2 text-weight-medium">{{ line.primary }}</div>
              <div v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6">
                {{ line.secondary }}
              </div>
              <div class="text-caption text-grey-7">
                Expected {{ line.expected }} • received {{ line.received }} • accepted {{ line.accepted }}
              </div>
              <div v-if="line.rejectedReason" class="text-caption text-italic text-grey-7">
                {{ line.rejectedReason }}
              </div>
            </div>
            <div class="col-auto">
              <q-badge rounded :color="lineProgressColor(line.outcome)" :label="lineProgressLabel(line.outcome)" />
            </div>
          </div>
          <q-separator v-if="index < rows.length - 1" class="q-mb-sm" />
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

defineOptions({ name: 'POReceivingsViewInspectedItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Inspected Items' },
  items: { type: Array, default: null }
})

const { evaluate, ui } = useReceivingViewContext()
const { lines, pending, lineProgressColor, lineProgressLabel } = useReceivingView()

const finalTitle = computed(() => evaluate(props.title))
const rows = computed(() => (props.items === null ? lines.value : props.items))

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
