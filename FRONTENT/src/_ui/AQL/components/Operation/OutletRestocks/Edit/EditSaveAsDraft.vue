<template>
  <div :class="gutterClass">
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
            <q-toggle :model-value="isDraft" color="primary" @update:model-value="setDraft" />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletRestocks › Edit — draft toggle, mirroring `Add/SubmitOptions.vue`'s draft
 * card so the same wizard-only intent control exists on both entry points.
 *
 * `isDraft` lives in `controls`, not the record, and never reaches GAS — only
 * `Edit/PageAction.js` reads it back, to pick `Progress` and decide whether to
 * stamp the submission fields. Holds no state of its own (ARCHITECTURE RULES §6).
 */
import { computed, inject, useAttrs } from 'vue'

defineOptions({ name: 'OutletRestocksEditSaveAsDraft', inheritAttrs: false })

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)

const isDraft = computed(() => pageState.getControlField('OutletRestocks', 'isDraft') === true)

function setDraft (value) { pageState.setControlField('OutletRestocks', 'isDraft', value === true) }
</script>
