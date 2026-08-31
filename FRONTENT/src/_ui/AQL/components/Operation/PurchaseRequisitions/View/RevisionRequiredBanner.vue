<template>
  <div v-if="visible">
    <SectionDividerLabel :label="finalTitle" />
    <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
      <q-card-section>
        <div class="row items-center no-wrap q-gutter-sm">
          <q-icon :name="icon" size="24px" :color="color" />
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-bold">{{ headline }}</div>
            <div class="text-body2 q-mt-xs">{{ note }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRequisitionView } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionView'
import { useRequisitionViewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/View/useRequisitionViewContext'

defineOptions({ name: 'PurchaseRequisitionsViewRevisionRequiredBanner', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Action Needed' }
})

const { evaluate, ui } = useRequisitionViewContext()
const { pending, needsRevision, rejected, revisionNote, rejectionNote } = useRequisitionView()

const finalTitle = computed(() => evaluate(props.title))

// Hidden while loading too — flashing an instruction card in and out reads worse
// than showing it a moment late.
const visible = computed(() => !pending.value && (needsRevision.value || rejected.value))

const headline = computed(() => (needsRevision.value ? 'Revision Required' : 'Requisition Rejected'))
const icon = computed(() => (needsRevision.value ? 'undo' : 'cancel'))
const color = computed(() => (needsRevision.value ? 'orange' : 'negative'))
const note = computed(() => {
  const comment = needsRevision.value ? revisionNote.value : rejectionNote.value
  if (comment) return comment
  return needsRevision.value
    ? 'The approver asked for changes. Edit the requisition and resubmit it.'
    : 'This requisition was rejected. No reason was recorded.'
})
</script>
