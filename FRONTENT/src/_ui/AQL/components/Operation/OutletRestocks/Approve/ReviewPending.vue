<template>
  <div v-if="visible" :class="gutterClass">
    <!-- The other half of the decision: everything NOT being covered right now.
         Kept on the same review step as the allocations, because "what I am
         approving" and "what I am leaving unfilled" are one decision, not two. -->
    <SectionDividerLabel label="Remaining Items" />

    <q-card v-if="!stayingPending.length && !cancelling.length" class="aql-premium-card" flat>
      <q-card-section class="text-center q-py-lg">
        <q-icon name="task_alt" size="40px" color="positive" class="q-mb-sm block q-mx-auto" />
        <div class="text-subtitle1 text-weight-bold text-grey-7">Every requested unit is covered</div>
        <div class="text-caption text-grey-6">Nothing will be left pending on this request.</div>
      </q-card-section>
    </q-card>

    <!-- Two lists rather than one with a status column: they are different
         outcomes — one is deferred work, the other is work that will never happen
         — and a mobile row has no room to make that distinction legible. -->
    <AqlGroupedList
      v-if="stayingPending.length"
      :items="stayingPending"
      item-key="code"
      group-key="productCode"
      header-label="productName"
      card-class="aql-premium-card q-mb-sm"
      :content="[(item) => item.variantLabel]"
      :layout="['label']"
      chip="remainder"
      chipColor="warning"
    >
      <template #header-right="{ group }">
        <div class="text-subtitle1 text-weight-bold text-warning q-pr-md">{{ groupTotal(group) }}</div>
      </template>
    </AqlGroupedList>

    <AqlGroupedList
      v-if="cancelling.length"
      :items="cancelling"
      item-key="code"
      group-key="productCode"
      header-label="productName"
      card-class="aql-premium-card q-mb-sm"
      :content="[(item) => item.variantLabel]"
      :layout="['label']"
      :meta="[() => 'Will be cancelled', () => 'no stock movement', (item) => String(item.remainder)]"
      :meta-layout="['caption', 'caption', 'label']"
      meta-color="negative"
    >
      <template #header-right="{ group }">
        <div class="text-subtitle1 text-weight-bold text-negative">{{ groupTotal(group) }}</div>
      </template>
    </AqlGroupedList>

    <q-banner v-if="cancelling.length" rounded dense class="bg-grey-2">
      <template #avatar>
        <q-icon name="info" color="grey-7" />
      </template>
      <div class="text-body2">
        Cancelled lines write no stock movement — those units were never taken out
        of the warehouse. The lines are stamped Cancelled and stop appearing as
        outstanding.
      </div>
    </q-banner>

    <!-- One comment for the decision. Deliberately not a field per outcome: the
         approver writes one note, and the button they press files it. -->
    <SectionDividerLabel label="Comment" />

    <q-card class="aql-premium-card" flat>
      <q-card-section>
        <component
          :is="CommentField"
          :model-value="comment"
          :record="restock"
          :config="commentConfig"
          header="ProgressApprovedComment"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 2b of the restock approval: what is NOT being fulfilled, and why.
 *
 * Read-only over the plan — the cancel/keep decision itself is made on step 1
 * beside the line it applies to, where the shortfall and the available bins are
 * both in view. Restating it as an editable control here would let the approver
 * write off a line without seeing the stock they are writing it off against.
 *
 * The comment is the one input on this step. It is stored as a control field, not
 * a record field, so it never leaks into a payload on its own — the sticky bar's
 * handler places it on the right column for the outcome chosen.
 */
import { computed, inject, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlGroupedList from 'components/app/AqlGroupedList.vue'
import { resolveFieldComponent } from 'components/_fields/useFieldResolver'
import { useRestockApproval } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockApproval'

defineOptions({ name: 'OutletRestocksApproveReviewPending', inheritAttrs: false })

const props = defineProps({
  step: { type: Number, default: 2 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const { restock, pendingRows, comment, setComment } = useRestockApproval()

const visible = computed(() => pageState?.meta.currentStep === props.step)

// Resolved through the field registry rather than a direct import, so the comment
// box picks up whatever the textarea control does (AQL_CUSTOM_UI_GUIDE §2.3).
const CommentField = resolveFieldComponent('textarea', 'edit')

const commentConfig = computed(() => ({
  label: 'Comment',
  hint: 'Recorded against this approval.'
}))

const stayingPending = computed(() => pendingRows.value.filter((row) => !row.cancelled))
const cancelling = computed(() => pendingRows.value.filter((row) => row.cancelled))

function groupTotal (group) {
  return (group?.items || []).reduce((sum, item) => sum + Number(item.remainder || 0), 0)
}
</script>
