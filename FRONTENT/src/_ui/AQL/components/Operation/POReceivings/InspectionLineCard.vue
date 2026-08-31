<template>
  <q-card flat bordered :class="ui.cardClass">
    <q-card-section :class="gutterClass">
      <div class="row items-start no-wrap">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-body2 text-weight-medium">{{ line.primary }}</div>
          <div v-if="line.secondary && line.secondary !== line.primary" class="text-caption text-grey-6">
            {{ line.secondary }}
          </div>
          <div class="text-caption text-grey-7">Expected {{ line.ExpectedQty }} {{ line.uom }}</div>
        </div>
        <div class="col-auto">
          <q-badge rounded :color="lineProgressColor(line.Outcome)" :label="lineProgressLabel(line.Outcome)" />
        </div>
      </div>

      <div class="row q-col-gutter-sm">
        <div class="col-4">
          <FieldNumberEdit
            :model-value="line.ReceivedQty"
            :record="line"
            :config="receivedConfig"
            header="ReceivedQty"
            @update:model-value="(value) => emitUpdate('ReceivedQty', value)"
          />
        </div>
        <div class="col-4">
          <FieldNumberEdit
            :model-value="line.DamagedQty"
            :record="line"
            :config="damagedConfig"
            header="DamagedQty"
            @update:model-value="(value) => emitUpdate('DamagedQty', value)"
          />
        </div>
        <div class="col-4">
          <FieldNumberEdit
            :model-value="line.RejectedQty"
            :record="line"
            :config="rejectedConfig"
            header="RejectedQty"
            @update:model-value="(value) => emitUpdate('RejectedQty', value)"
          />
        </div>
      </div>

      <div class="text-caption text-grey-7">
        {{ line.ReceivedQty }} − {{ line.DamagedQty }} − {{ line.RejectedQty }} = {{ line.AcceptedQty }} accepted
      </div>

      <FieldTextEdit
        v-if="line.RejectedQty > 0"
        :model-value="line.RejectedReason"
        :record="line"
        :config="reasonConfig"
        header="RejectedReason"
        @update:model-value="(value) => emitUpdate('RejectedReason', value)"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldNumberEdit from 'src/_fields/number/Edit.vue'
import FieldTextEdit from 'src/_fields/text/Edit.vue'
import { useReceivingFormContext } from 'src/_ui/AQL/composables/Operation/POReceivings/useReceivingFormContext'
import { lineProgressColor, lineProgressLabel } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'

defineOptions({ name: 'POReceivingsInspectionLineCard', inheritAttrs: false })

const props = defineProps({
  line: { type: Object, required: true },
  editable: { type: Boolean, default: true }
})

const emit = defineEmits(['update'])

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui } = useReceivingFormContext()

// Disabled rather than hidden: the question still stands, the answer is just locked.
const receivedConfig = computed(() => ({ label: 'Received', dense: true, disable: !props.editable }))
const damagedConfig = computed(() => ({ label: 'Damaged', dense: true, disable: !props.editable }))
const rejectedConfig = computed(() => ({ label: 'Rejected', dense: true, disable: !props.editable }))
const reasonConfig = computed(() => ({ label: 'Rejection reason', dense: true, disable: !props.editable }))

function emitUpdate (field, value) {
  emit('update', { key: props.line.key, field, value })
}
</script>
