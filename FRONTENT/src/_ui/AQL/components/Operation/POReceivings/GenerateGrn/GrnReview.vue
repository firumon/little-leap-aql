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
        <div class="row items-center no-wrap q-gutter-sm">
          <q-icon name="receipt_long" size="24px" color="primary" />
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-bold">Post {{ summary.accepted }} accepted units</div>
            <div class="text-caption text-grey-8">
              {{ receiving.PurchaseOrderCode }} · {{ postingLines.length }} lines reach the goods receipt
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-banner v-if="!pending && receiving && !grnReady" dense rounded class="bg-orange-2">
      <template #avatar>
        <q-icon name="lock" color="orange-9" />
      </template>
      Only a confirmed receiving can generate a goods receipt.
    </q-banner>

    <q-card v-else-if="!pending && receiving" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">What will be posted</div>

        <div v-if="!postingLines.length" class="text-center q-py-lg">
          <q-icon name="block" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing accepted</div>
          <div :class="ui.emptyCaptionClass">Every line was damaged or rejected, so a goods receipt would be empty.</div>
        </div>

        <div v-else :class="ui.detailGridClass">
          <div
            v-for="(line, index) in postingLines"
            :key="line.code"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="[ui.detailKeyClass, ui.flexWrapTextClass]">{{ line.primary }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.accepted }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="!pending && receiving && grnReady" flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Note for the record</div>
        <FieldTextareaEdit
          :model-value="comment"
          :record="receiving"
          :config="COMMENT_CONFIG"
          header="ProgressGRNGeneratedComment"
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

defineOptions({ name: 'POReceivingsGenerateGrnGrnReview', inheritAttrs: false })

const COMMENT_CONFIG = { label: 'Comment (optional)' }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, receiving, pending, postingLines, summary, grnReady, comment, setComment } = useReceivingActionContext()

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
