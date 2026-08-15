<template>
  <div :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <!-- Outlet and date are fixed for the life of a restock: the request was
             raised for one outlet, and re-pointing it at another would silently
             rewrite what the approver already saw. Both are stated, not offered. -->
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in summaryLines"
            :key="line.key"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.key }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Retained deliberately: the Edit URL is reachable directly, so a request
         that has moved on since the link was opened has to say why nothing here
         will save rather than failing at the sticky bar. -->
    <q-banner
      v-if="!isEditable"
      rounded
      dense
      class="bg-warning text-black"
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
 * The one workflow fact it DOES state is the revision note, because that is the
 * instruction the user is here to act on — it belongs above the item cards, not
 * behind a tab.
 *
 * Layout binds to the UI design tokens relayed from `useAQLConfig()`.
 *
 * It is also where the page hydrates: this is the first content the Edit contract
 * renders and `useRestockEditForm` owns the load, since the contract has no
 * `Update` component to do it (see that composable).
 *
 * Holds no state — the composable projects pageState and writes straight back
 * (ARCHITECTURE RULES §6). No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRestockEditForm } from 'src/_ui/AQL/composables/Operation/OutletRestocks/Edit/useRestockEditForm'
import { restockEditableProgress } from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

defineOptions({ name: 'OutletRestocksEditRestockHeader', inheritAttrs: false })

const ui = useAQLConfig()

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — UI_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || ui.gutterFallback || 'sm'}`)

const { parent, outletName, restockDate, isRevision, revisionNote } = useRestockEditForm()

// A restock may only be edited in DRAFT or REVISION_REQUIRED. Any other state
// renders read-only with a lock banner — this page is for revising a returned
// request, not for rewriting settled history.
const isEditable = computed(() => restockEditableProgress(parent.record.value.Progress))

// The revision note is appended rather than always present: on a DRAFT there was
// no revision, and an empty row would read as a note that says nothing.
const summaryLines = computed(() => {
  const lines = [
    { key: 'Outlet', value: outletName.value || '—' },
    { key: 'Requested on', value: restockDate.value || '—' }
  ]
  if (isRevision.value && revisionNote.value) {
    lines.push({ key: 'Revision Note', value: revisionNote.value })
  }
  return lines
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
