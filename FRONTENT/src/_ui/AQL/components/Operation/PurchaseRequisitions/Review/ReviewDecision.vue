<template>
  <div v-if="!pending" :class="gutterClass">
    <q-banner v-if="!reviewable" dense rounded class="bg-orange-2">
      <template #avatar>
        <q-icon name="lock" color="orange-9" />
      </template>
      This requisition is no longer awaiting approval, so no verdict can be recorded.
    </q-banner>

    <q-card v-else flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Your comment</div>
        <div class="text-caption text-grey-8">
          Required to send the requisition back or to reject it. Optional when approving.
        </div>
        <FieldTextareaEdit
          :model-value="comment"
          :record="requisition || EMPTY_RECORD"
          :config="COMMENT_CONFIG"
          header="ProgressApprovedComment"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldTextareaEdit from 'src/_fields/textarea/Edit.vue'
import { useRequisitionReviewContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Review/useRequisitionReviewContext'

defineOptions({ name: 'PurchaseRequisitionsReviewDecision', inheritAttrs: false })

const COMMENT_CONFIG = { label: 'Comment' }
const EMPTY_RECORD = {}

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, requisition, pending, reviewable, comment, setComment } = useRequisitionReviewContext()
</script>
