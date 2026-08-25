<template>
  <div>
    <SectionDividerLabel label="REASON" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row" :class="[gutterXClass, gutterYClass]">
          <div class="col-12">
            <FieldSelectAdd
              :model-value="form.Reason"
              :record="form"
              :config="{ label: 'Reason', options: reasonOptions, clearable: false }"
              header="Reason"
              @update:model-value="setReason"
            />
          </div>
          <div class="col-12">
            <FieldTextareaAdd
              :model-value="form.ReasonComment"
              :record="form"
              :config="{ label: commentLabel, rows: 3 }"
              header="ReasonComment"
              @update:model-value="setReasonComment"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldSelectAdd from 'src/_fields/select/Add.vue'
import FieldTextareaAdd from 'src/_fields/textarea/Add.vue'
import { useReturnFormFields } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields'

defineOptions({ name: 'OutletReturnsFormReason', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')
const gutterXClass = computed(() => `q-col-gutter-x-${gutter.value}`)
const gutterYClass = computed(() => `q-gutter-y-${gutter.value}`)

const {
  ui,
  form,
  reasonOptions,
  commentLabel,
  setReason,
  setReasonComment
} = useReturnFormFields()
</script>
