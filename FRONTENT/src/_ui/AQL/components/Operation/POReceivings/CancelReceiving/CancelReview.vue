<template>
  <div :class="gutterClass">
    <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!receiving" class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Receiving not found</div>
        <div :class="ui.emptyCaptionClass">The record may have been removed since this link was opened.</div>
      </q-card-section>

      <q-card-section v-else>
        <div class="row items-center no-wrap q-gutter-sm q-mb-sm">
          <q-icon name="cancel" size="24px" color="negative" />
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-bold">Cancel this receiving</div>
            <div class="text-caption text-grey-8">{{ receiving.PurchaseOrderCode }} · {{ receiving.Code }}</div>
          </div>
        </div>

        <div :class="ui.detailGridClass">
          <div v-for="line in consequences" :key="line.label" class="items-center" :class="ui.detailLineClass">
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-banner v-if="!pending && receiving && !cancellable" dense rounded class="bg-orange-2">
      <template #avatar>
        <q-icon name="lock" color="orange-9" />
      </template>
      This receiving is already cancelled.
    </q-banner>

    <q-card v-else-if="!pending && receiving" flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Why is it being cancelled?</div>
        <FieldTextareaEdit
          :model-value="comment"
          :record="receiving"
          :config="COMMENT_CONFIG"
          header="ProgressCancelledComment"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldTextareaEdit from 'src/_fields/textarea/Edit.vue'
import { useReceivingActionContext } from 'src/_ui/AQL/composables/Operation/POReceivings/useReceivingActionContext'

defineOptions({ name: 'POReceivingsCancelReceivingCancelReview', inheritAttrs: false })

const COMMENT_CONFIG = { label: 'Cancellation reason' }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, receiving, pending, goodsReceipt, cancellable, comment, setComment } = useReceivingActionContext()

const consequences = computed(() => {
  if (!receiving.value) return []
  return [
    {
      label: 'Goods receipt',
      value: goodsReceipt.value ? `${goodsReceipt.value.Code} is invalidated` : 'None was generated'
    },
    { label: 'Procurement', value: 'Returns to purchase order issued' }
  ]
})
</script>
