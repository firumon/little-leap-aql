<template>
  <div :class="gutterClass">
    <template v-if="isDraftState">
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle1 text-weight-medium">Save as draft</div>
              <div class="text-caption text-grey-8">
                Keep this requisition private until you are ready to send it for approval.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle :model-value="isDraft" color="primary" @update:model-value="setDraft" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card v-if="!isDraft" flat bordered :class="ui.cardClass">
        <q-card-section :class="gutterClass">
          <div class="text-subtitle1 text-weight-medium">Submission comment</div>
          <div class="text-caption text-grey-8">
            Anything the approver should know. Sent with the requisition.
          </div>
          <FieldTextareaEdit
            :model-value="comment"
            :record="record"
            :config="COMMENT_CONFIG"
            header="ProgressSubmittedComment"
            @update:model-value="setComment"
          />
        </q-card-section>
      </q-card>
    </template>

    <q-card v-else-if="isRevision" flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Resubmission comment</div>
        <div class="text-caption text-grey-8">
          Tell the approver what changed. Sent with the requisition when you resubmit.
        </div>
        <FieldTextareaEdit
          :model-value="comment"
          :record="record"
          :config="RESUBMIT_CONFIG"
          header="ProgressSubmittedComment"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import FieldTextareaEdit from 'src/_fields/textarea/Edit.vue'
import { useRequisitionFormContext } from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/useRequisitionFormContext'

defineOptions({ name: 'PurchaseRequisitionsSubmitOptions', inheritAttrs: false })

const COMMENT_CONFIG = { label: 'Comment (optional)' }
const RESUBMIT_CONFIG = { label: 'Resubmission comment (optional)' }

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, record, isDraftState, isRevision, isDraft, comment, setDraft, setComment } = useRequisitionFormContext()
</script>
