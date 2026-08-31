import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import {
  buildRestockChainNodes,
  defaultSubmissionComment,
  RESTOCK_CONTROL
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'

const NODE = 'OutletRestocks'
const ITEMS = 'OutletRestockItems'

const text = (value) => (value == null ? '' : String(value).trim())

export default {
  sections: ['PageHeader'],
  contents: [
    'OutletSelection',
    'AdjustItems',
    'NewItems',
    'Review',
    'SubmitOptions'
  ],
  PropsPageHeader: {
    reload: false
  },
  // `AdjustItems`/`NewItems` are shared with the Edit page, which has no wizard —
  // so the step they belong to is declared here rather than hardcoded in them.
  PropsAdjustItems: { step: 2 },
  PropsNewItems: { step: 2 },

  // Seed the submission note so step 3 shows it and the user can amend it. It used to be
  // invented inside the builder at submit, which meant the note nobody had seen was the
  // note that got filed (UI_PAGE_STATE.md §5B).
  ready ({ pageState }) {
    const { user } = useAuth()

    if (!pageState.getRecord('ProgressSubmittedComment', NODE)) {
      pageState.setRecord('ProgressSubmittedComment', defaultSubmissionComment(false), NODE)
    }

    // The lines the officer typed, as a stable STRING. The builder writes its own rows back
    // into the same bucket (with Progress, Status and the warehouse split on them), so a
    // watcher over the rows themselves would chase its own output — a digest of just the
    // answers cannot (UI_PAGE_STATE.md §5B.3).
    const lineDigest = () => (pageState.getChildRows(ITEMS, NODE) || [])
      .map((row) => `${text(row?.SKU)}:${Number(row?.Quantity) || 0}:${text(row?._action)}`)
      .join('|')

    const mode = () => text(pageState.getControls('RestockMode', null, NODE)) || 'STANDARD'
    const warehouse = () => text(pageState.getControls(RESTOCK_CONTROL.WAREHOUSE, null, NODE))

    // The whole submission — request, lines and any direct-restock movements — is cut on
    // every answer, so step 3 reviews the actual batch and `PageAction.submit` only
    // validates (UI_PAGE_STATE.md §5B).
    watch(() => [
      text(pageState.getRecord('OutletCode', NODE)),
      text(pageState.getRecord('Date', NODE)),
      text(pageState.getRecord('ProgressSubmittedComment', NODE)),
      mode(),
      warehouse(),
      pageState.getControls('isDraft', false, NODE) === true,
      lineDigest()
    ], () => {
      const lines = (pageState.getChildRows(ITEMS, NODE) || [])
        .filter((row) => row?._action !== 'deactivate')
        .map((row) => ({ SKU: text(row?.SKU), Quantity: Number(row?.Quantity) || 0 }))
      if (!text(pageState.getRecord('OutletCode', NODE)) || !lines.length) return

      pageState.applyLive(buildRestockChainNodes({
        form: pageState.getRecord(null, NODE) || {},
        lines,
        mode: mode(),
        draft: pageState.getControls('isDraft', false, NODE) === true && mode() !== 'DIRECT',
        warehouseCode: warehouse(),
        linkToConsumption: false,
        comment: text(pageState.getRecord('ProgressSubmittedComment', NODE)),
        actorName: text(user.value?.name || user.value?.email)
      }))
    })
  }
}
