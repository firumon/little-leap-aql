<template>
  <div :class="gutterClass">
    <!-- DRAFT: the request has never been submitted, so the first question is
         whether this save submits it. The toggle leads because it decides whether
         the comment below is asked for at all. -->
    <template v-if="isDraftState">
      <q-card class="aql-premium-card bg-primary-light" flat>
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
                data-testid="restock-edit-draft-toggle"
                @update:model-value="setDraft"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Only once the toggle is OFF is this save actually a submission, and only
           then does the comment have a reader. Same gate, same wording and the same
           `ProgressSubmittedComment` header as the Add wizard's step 3
           (`Add/SubmitOptions.vue`) — a draft submitted from Edit and one submitted
           from the wizard must ask the requester for the same thing. -->
      <q-card v-if="!isDraft" class="aql-premium-card" flat>
        <q-card-section :class="gutterClass">
          <div class="text-subtitle1 text-weight-medium">Submission comment</div>
          <div class="text-caption text-grey-8">
            Anything the approver should know. Sent with the request when you submit.
          </div>
          <FieldTextareaEdit
            :model-value="comment"
            :record="parent.record.value"
            :config="{ label: 'Comment (optional)' }"
            header="ProgressSubmittedComment"
            data-testid="restock-edit-submit-comment"
            @update:model-value="setComment"
          />
        </q-card-section>
      </q-card>
    </template>

    <!-- REVISION_REQUIRED: the request is already in the workflow and this save
         sends it back to the approver, so the only question is what to tell them.
         Going back to draft is not offered — the request has left that state, and
         the comment is therefore unconditional rather than gated on a toggle. -->
    <q-card v-else-if="isRevision" class="aql-premium-card" flat>
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Resubmission comment</div>
        <div class="text-caption text-grey-8">
          Tell the approver what changed. Sent with the request when you resubmit.
        </div>
        <FieldTextareaEdit
          :model-value="comment"
          :record="parent.record.value"
          :config="{ label: 'Resubmission comment (optional)' }"
          header="ProgressSubmittedComment"
          data-testid="restock-edit-resubmit-comment"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletRestocks › Edit — the submit-intent card, one control per entry state.
 *
 * The two editable states ask genuinely different questions, so the card shows
 * the controls each one actually needs rather than both greyed against each other:
 *
 *   DRAFT              → "is this still a draft?"   (the toggle)
 *                        …and, only once that is OFF, "anything for the approver?"
 *   REVISION_REQUIRED  → "what changed?"            (the comment, unconditional)
 *
 * A returned request is already in the workflow and cannot go back to being a
 * draft, so offering the toggle there would advertise a transition the submit
 * handler does not perform. On a DRAFT the comment is GATED on the toggle for the
 * mirror reason: while it stays a draft the request has not been submitted, so a
 * submission comment has no reader yet — asking first and then withdrawing the
 * question reads as the card changing its mind.
 *
 * The toggle DEFAULTS ON for a draft (seeded in `useRestockEditForm`'s hydration):
 * a user who opens their own draft to adjust item lines and hits the primary button
 * must save it, not accidentally submit it.
 *
 * Neither control submits: both only record intent on pageState, and the sticky
 * bar (`Edit/PageAction.js`) reads it back — a content card that submitted would
 * double-fire against the PageAction dispatcher (UI_ACTION_SYSTEM.md §5).
 * `isDraft` is page-only intent, so it lives in `controls` and never reaches GAS;
 * the comment is a real resource header, so it goes through `setField`.
 *
 * The comment is READ BACK OFF THE NODE, not held in a local ref — which is what
 * pre-seeds it: `useRestockEditForm`'s hydration has already loaded the record's
 * existing `ProgressSubmittedComment` onto the node, so a submit → revision →
 * resubmit cycle shows the previous text for the user to amend rather than
 * silently dropping it.
 *
 * Replaces `EditSaveAsDraft.vue`. No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import FieldTextareaEdit from 'src/_fields/textarea/Edit.vue'
import { useRestockEditForm } from 'src/_ui/AQL/composables/Operation/OutletRestocks/Edit/useRestockEditForm'

defineOptions({ name: 'OutletRestocksEditSubmitOptions', inheritAttrs: false })

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — UI_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, parent, progress, isRevision, comment, setComment } = useRestockEditForm()

const isDraftState = computed(() => progress.value === 'DRAFT')

const isDraft = computed(() => pageState.getControlField('OutletRestocks', 'isDraft') === true)

function setDraft (value) { pageState.setControlField('OutletRestocks', 'isDraft', value === true) }
</script>
