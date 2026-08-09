<template>
  <div :class="gutterClass">
    <q-card class="aql-premium-card" flat>
      <q-card-section :class="gutterClass">
        <!-- Outlet and date are fixed for the life of a restock: the request was
             raised for one outlet, and re-pointing it at another would silently
             rewrite what the approver already saw. Both are stated, not offered. -->
        <div class="row no-wrap q-col-gutter-sm">
          <div class="col">
            <div class="text-caption text-grey-7">Outlet</div>
            <div class="text-subtitle1 text-weight-medium">{{ outletName }}</div>
          </div>
          <div class="col-auto text-right">
            <div class="text-caption text-grey-7">Requested on</div>
            <div class="text-subtitle1 text-weight-medium">{{ restockDate }}</div>
          </div>
        </div>

        <q-separator />

        <q-banner
          v-if="!isEditable"
          rounded
          dense
          class="q-mb-md bg-warning text-black"
          data-testid="restock-locked-banner"
        >
          <template #avatar>
            <q-icon name="lock" />
          </template>
          <div class="text-body2">
            Editing is disabled because this restock request is currently in
            {{ parent.record.value.Progress || 'locked' }} state.
          </div>
        </q-banner>

        <FieldTextareaEdit
          :model-value="comment"
          :record="parent.record.value"
          :config="{ label: 'Comment (optional)', disable: !isEditable }"
          header="ProgressSubmittedComment"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletRestocks › Edit — the parent-record card.
 *
 * Deliberately NOT a progress display. The Edit page exists to revise the item
 * lines of a request that has come back for revision; restating the workflow
 * badge here would invite the user to read this page as a place to move the
 * request through its lifecycle, which is the approval view's job.
 *
 * It is also where the page hydrates: this is the first content the Edit contract
 * renders and `useRestockEditForm` owns the load, since the contract has no
 * `Update` component to do it (see that composable).
 *
 * Holds no state — the composable projects pageState and writes straight back
 * (ARCHITECTURE RULES §6).
 */
import { computed, useAttrs } from 'vue'
import FieldTextareaEdit from 'components/_fields/textarea/Edit.vue'
import { useRestockEditForm } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockEditForm'
import { restockEditableProgress } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockProgress'

defineOptions({ name: 'OutletRestocksEditRestockHeader', inheritAttrs: false })

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { parent, outletName, restockDate, comment, setComment } = useRestockEditForm()

// A restock may only be edited in DRAFT or REVISION_REQUIRED. Any other state
// renders the rest with read-only display and a lock banner — the header's card
// is for revising a returned request, not for rewriting settled history.
const isEditable = computed(() => restockEditableProgress(parent.record.value.Progress))
</script>
