<template>
  <div v-if="pageState?.meta.currentStep === 3" :class="gutterClass">
    <!-- Draft is a standard-request concept only. A direct restock moves stock in
         the same batch it is created, so there is nothing to come back and submit
         later — the card is not rendered rather than shown disabled.

         It leads the step because it decides whether the comment below is asked
         for at all: a draft is not a submission, so there is nothing to comment
         on yet. Asking first and then withdrawing the question reads as the card
         changing its mind. -->
    <q-card v-if="!isDirect" class="aql-premium-card bg-primary-light" flat>
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col">
            <div class="text-subtitle1 text-weight-medium">Save as draft</div>
            <div class="text-caption text-grey-8">
              Save this restock request as a draft to complete or submit later.
            </div>
          </div>
          <div class="col-auto">
            <q-toggle
              :model-value="isDraft"
              color="primary"
              data-testid="restock-add-draft-toggle"
              @update:model-value="setDraft"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- The comment is what the approver reads WITH the submission, so it is only
         asked for when there is going to be one. -->
    <q-card v-if="!isDraft" class="aql-premium-card" flat>
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Submission comment</div>
        <FieldTextareaAdd
          :model-value="comment"
          :record="parent.record.value"
          :config="{ label: 'Comment (optional)' }"
          header="ProgressSubmittedComment"
          data-testid="restock-add-comment"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 3b of the restock wizard: the draft/submit choice plus the comment.
 *
 * The draft toggle comes FIRST because it gates the comment: a draft has not been
 * submitted, so there is nothing for an approver to read yet and the textarea is
 * withdrawn rather than left collecting text that would never be shown.
 *
 * Both controls only record intent on pageState. The sticky bar
 * (`Add/PageAction.js`) reads `isDraft` back off the node to pick the Progress
 * value — a content card never submits on its own, or it would double-fire
 * against the PageAction dispatcher (AQL_ACTION_SYSTEM.md §5).
 *
 * The comment is a real resource header (`ProgressSubmittedComment`), so it goes
 * through `setField` and rides along in the create payload; `isDraft` is
 * wizard-only intent, so it lives in `controls` and never reaches GAS.
 */
import { computed, inject, useAttrs } from 'vue'
import FieldTextareaAdd from 'components/_fields/textarea/Add.vue'

defineOptions({ name: 'OutletRestocksSubmitOptions', inheritAttrs: false })

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const parent = pageState.useNode('OutletRestocks')

const comment = computed(() => parent.record.value.ProgressSubmittedComment || '')
const isDirect = computed(() => pageState.getControlField('OutletRestocks', 'RestockMode') === 'DIRECT')
const isDraft = computed(() => pageState.getControlField('OutletRestocks', 'isDraft') === true)

function setComment (value) { pageState.setField('OutletRestocks', 'ProgressSubmittedComment', value ?? '') }
function setDraft (value) { pageState.setControlField('OutletRestocks', 'isDraft', value === true) }
</script>
