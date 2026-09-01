import { inject, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import {
  autoDistribute as calcAutoDistribute,
  isWaiverEligible,
  residualThreshold,
  waiverCommentOf
} from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentAllocation'
import { settlementReasons } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { buildOutletPaymentCreationNodes, stampPaymentRowsInPageState } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'

// OutletPayments › Add — one inject() for the three step cards, and the one place the
// wizard's state lives. One collection becomes several receipt ROWS, one per invoice it
// settles, held in `records`; how it was taken stays in `controls`. Every change re-applies
// the Layer 2 node graph, so what is reviewed is what is submitted.
//
// Knock-ons live in the SETTERS, not a watch(): this relay runs once per consuming card, so
// a watch here would be registered three times and fire three times per change.

const NODE = 'OutletPayments'

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const money2 = (value) => Number(num(value).toFixed(2))

/**
 * How a collection was taken. Ordered by how often it is used rather than alphabetically, so
 * the common case is the first thing under the thumb.
 */
export const MODE_OPTIONS = ['Cash', 'Bank Transfer', 'Cheque', 'Card', 'Other']

export const MODE_ICONS = {
  Cash: 'payments',
  'Bank Transfer': 'account_balance',
  Cheque: 'history_edu',
  Card: 'credit_card',
  Other: 'more_horiz'
}

// Why a residual balance was written off. The list is AppOptions data, owned by the invoice
// domain — the value lands in the invoice's own `SettlementReason` column, which the sheet
// validates against exactly that list.

export function useOutletPaymentAddContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)

  const route = useRoute()
  const ui = useAQLConfig()
  const { _C } = useCurrencyResource()
  const { user } = useAuth()
  const index = useOutletPaymentIndex()

  // Who is collecting and when. Read here and stamped by Layer 2 from the same two sources.
  const collectorName = computed(() => text(user.value?.name || user.value?.email) || 'Unknown')
  const collectionDate = computed(() => new Date().toISOString().slice(0, 10))

  // ── The wizard's answers ────────────────────────────────────────────────────
  const field = (header, fallback = '') => {
    const value = pageState?.getControls(header, null, NODE)
    return value === undefined || value === null ? fallback : value
  }
  const setField = (header, value) => pageState?.setControls(header, value, NODE)

  const outletOptions = computed(() => index.rawOutlets.value
    .map((outlet) => ({
      value: text(outlet.Code),
      label: text(outlet.Name) || text(outlet.Code)
    }))
    .sort((a, b) => a.label.localeCompare(b.label)))

  /** The outlet's open invoices, oldest first — the order a debt is settled in. */
  const outletInvoices = computed(() => {
    const outlet = text(field('OutletCode'))
    if (!outlet) return []
    return index.openInvoices.value
      .filter((row) => text(row.outletCode) === outlet)
      .sort((a, b) => text(a.date).localeCompare(text(b.date)))
  })

  // The receipt rows ARE the answer. One row per invoice this collection settles, carrying
  // that invoice's code and its share - both real columns, so neither is a control.
  const rows = () => pageState?.getRecordRows(NODE) || []
  const rowIndexOf = (code) => rows().findIndex((row) => text(row.OutletConsumptionInvoiceCode) === text(code))

  const selectedCodes = computed(() => {
    pageState?.useNode(NODE)
    return rows().map((row) => text(row.OutletConsumptionInvoiceCode)).filter(Boolean)
  })

  /** The chosen invoices, as aggregate rows — never as bare codes. */
  const selectedInvoices = computed(() => {
    const chosen = new Set(selectedCodes.value)
    return outletInvoices.value.filter((row) => chosen.has(text(row.code)))
  })

  /** What the chosen invoices still owe, in total. The natural default for the amount. */
  const selectedBalance = computed(() =>
    money2(selectedInvoices.value.reduce((sum, row) => sum + num(row.balance), 0)))

  /** What the outlet owes across every open invoice, chosen or not. */
  const outletBalance = computed(() =>
    money2(outletInvoices.value.reduce((sum, row) => sum + num(row.balance), 0)))

  const selectedTotal = computed(() =>
    money2(selectedInvoices.value.reduce((sum, row) => sum + num(row.total), 0)))

  const selectedCollected = computed(() =>
    money2(selectedInvoices.value.reduce((sum, row) => sum + num(row.collected), 0)))

  const amount = computed({
    get: () => num(field('Amount', 0)),
    // Re-splitting on every keystroke is deliberate: the allocation grid is a breakdown OF the
    // amount, and one that lags the figure above it is a breakdown of a number nobody typed.
    set: (value) => {
      setField('Amount', money2(value))
      distribute(money2(value))
    }
  })

  const allocations = computed(() => {
    pageState?.useNode(NODE)
    return rows().reduce((map, row) => {
      const code = text(row.OutletConsumptionInvoiceCode)
      if (code) map[code] = num(row.Amount)
      return map
    }, {})
  })

  const mode = computed({
    get: () => text(field('Mode')) || 'Cash',
    set: (value) => setField('Mode', text(value) || 'Cash')
  })

  const reference = computed({
    get: () => text(field('Reference')),
    set: (value) => setField('Reference', text(value))
  })

  const waiveResidual = computed({
    get: () => field('WaiveResidual', false) === true,
    set: (value) => setField('WaiveResidual', value === true)
  })

  const waiverReasons = computed(() => settlementReasons())

  const waiverReason = computed({
    get: () => text(field('WaiverReason')) || waiverReasons.value[0] || '',
    set: (value) => setField('WaiverReason', text(value))
  })

  const waiverComment = computed({
    get: () => text(field('WaiverComment')),
    set: (value) => setField('WaiverComment', text(value))
  })

  // ── Selection ───────────────────────────────────────────────────────────────

  // The amount follows the selection: settling the chosen invoices in full is what a
  // collector means almost every time, and typing over it is one gesture.
  function setSelectedCodes (codes) {
    const next = (Array.isArray(codes) ? codes : []).map(text).filter(Boolean)
    const wanted = new Set(next)
    for (let i = rows().length - 1; i >= 0; i--) {
      if (!wanted.has(text(rows()[i].OutletConsumptionInvoiceCode))) pageState?.removeRecord(i, NODE)
    }
    next.forEach((code) => {
      if (rowIndexOf(code) < 0) {
        pageState?.addRecord({ OutletCode: text(field('OutletCode')), OutletConsumptionInvoiceCode: code, Amount: 0 }, NODE)
      }
    })
    amount.value = selectedBalance.value
  }

  function toggleInvoice (code) {
    const key = text(code)
    if (!key) return
    const current = selectedCodes.value
    setSelectedCodes(current.includes(key)
      ? current.filter((entry) => entry !== key)
      : [...current, key])
  }

  const isAllSelected = computed(() =>
    outletInvoices.value.length > 0 &&
    selectedCodes.value.length === outletInvoices.value.length)

  function toggleSelectAll () {
    setSelectedCodes(isAllSelected.value ? [] : outletInvoices.value.map((row) => text(row.code)))
  }

  // Never the route query as a fallback: `initNode` seeds it in once, so the screen and the
  // submit path share one source of truth.
  const outletCode = computed({
    get: () => text(field('OutletCode')),
    set: (value) => {
      setField('OutletCode', text(value))
      // A different outlet has entirely different invoices; carrying the selection over would
      // allocate one outlet's payment against another's debt.
      setSelectedCodes([])
      setField('WaiveResidual', false)
    }
  })

  // ── Allocation ──────────────────────────────────────────────────────────────

  // Oldest invoice first. The rule is Layer 2's (`autoDistribute`) - it is an accounting
  // policy, not a presentation choice.
  function distribute (total) {
    const split = calcAutoDistribute(
      num(total),
      // The builder keys allocations by `Code`; aggregate rows carry both spellings.
      selectedInvoices.value.map((row) => ({ ...row, Code: text(row.code) })),
      index.rawPayments.value
    )
    Object.entries(split).forEach(([code, value]) => setAllocation(code, value))
  }

  /** The share written straight onto that invoice's receipt row. */
  function setAllocation (code, value) {
    const at = rowIndexOf(code)
    if (at >= 0) pageState?.setRecords(at, 'Amount', money2(value), NODE)
  }

  const totalAllocated = computed(() =>
    money2(Object.values(allocations.value).reduce((sum, value) => sum + num(value), 0)))

  /** How far the hand-typed split has drifted from the amount it is supposed to break down. */
  const allocationDiff = computed(() => money2(amount.value - totalAllocated.value))

  /** Snap the collected amount to whatever the grid now adds up to. */
  function reconcileToAllocations () {
    setField('Amount', totalAllocated.value)
  }

  // ── Residual waiver ─────────────────────────────────────────────────────────

  /** What would still be owed on the chosen invoices after this payment lands. */
  const residualBalance = computed(() => Math.max(0, money2(selectedBalance.value - amount.value)))

  // Each invoice must clear the test on its own: a shortfall spread over twenty invoices is
  // twenty write-offs, not one small one.
  const canWaiveResidual = computed(() => {
    if (residualBalance.value <= 0) return false
    if (!selectedInvoices.value.length) return false
    return selectedInvoices.value.every((row) => {
      const remaining = Math.max(0, money2(num(row.balance) - num(allocations.value[text(row.code)])))
      return remaining <= 0 || isWaiverEligible(remaining, row.PriceListCode)
    })
  })

  const waiverLimit = computed(() => residualThreshold(selectedInvoices.value[0]?.PriceListCode))

  // The audit sentence the waiver will write, built by the same Layer 2 function that
  // writes it - so the preview and the stored comment are one string.
  const waiverAuditComment = computed(() => waiverCommentOf(
    _C(amount.value, true),
    _C(selectedBalance.value, true),
    selectedInvoices.value.length,
    waiverReason.value
  ))

  // The receipt, invoice by invoice. `outcome` restates the transition Layer 2 will choose
  // from the same inputs - the one thing a reader cannot work out alone.
  const receiptLines = computed(() => selectedInvoices.value.map((row) => {
    const applied = num(allocations.value[text(row.code)])
    const remaining = Math.max(0, money2(num(row.balance) - applied))
    const waived = waiveResidual.value && remaining > 0 && isWaiverEligible(remaining, row.PriceListCode)

    return {
      code: text(row.code),
      date: text(row.date),
      balance: num(row.balance),
      applied,
      remaining,
      waived,
      outcome: (remaining <= 0 || waived) ? 'Fully paid' : 'Partially paid',
      settled: remaining <= 0 || waived
    }
  }))

  // ── Sources ─────────────────────────────────────────────────────────────────

  // `OutletConsumptionInvoices` must be here: the wizard IS a list of open invoices and
  // nothing else on this route fetches them. The rest supply names and current balances.
  const sources = ['OutletConsumptionInvoices', 'OutletPayments', 'Outlets']
    .map((name) => useRecord(name))

  /** Renders from cache and syncs the delta in the background — never blocks first paint. */
  const loadSources = () => Promise.all(sources.map((resource) => resource.reload()))

  // `reset: true` drops any node a previously-visited page left behind, so a receipt opened
  // straight after another form does not inherit its half-filled state.
  const initNode = () => {
    pageState?.initResource(NODE, {
      reset: true,
      isPrimaryKey: true,
      fields: {
        // Stamped here as well as in the payload builder so the review step states the date
        // that will actually be written rather than implying "now, whenever you submit".
        Date: new Date().toISOString().slice(0, 10),
        Progress: 'SUBMITTED',
        Status: 'Active'
      }
    })

    setField('Mode', 'Cash')

    // Whatever the row that opened this page knew. Going through the setters resolves the
    // outlet's invoice list and the default amount exactly as picking them by hand would.
    const seededOutlet = text(route.query.outletCode)
    const seededInvoice = text(route.query.invoiceCode)

    if (seededOutlet && !text(field('OutletCode'))) outletCode.value = seededOutlet
    if (seededInvoice && !selectedCodes.value.length) setSelectedCodes([seededInvoice])
  }

  // `initNode` runs before the fetch settles, so a seeded invoice has no balance yet. This
  // fills the amount in afterwards, but only while the user has typed nothing of their own.
  const reseedAmount = () => {
    if (num(field('Amount', 0)) > 0) return
    if (!selectedCodes.value.length) return
    amount.value = selectedBalance.value
  }

  // THE LIVE BATCH: every answer goes to Layer 2 at once, so step 3 reviews the real rows
  // and `PageAction.submit` only validates (UI_PAGE_STATE.md §5B).
  // `applyNodes` only ever adds, and a stamp is keyed by its invoice's own code - so a
  // deselected invoice keeps its queued transition unless the tail is taken down first.
  function clearDependentNodes () {
    pageState?.excludeAdditionalAction()
    pageState?.removeNode('OutletConsumptionInvoices')
  }

  function rebuild () {
    clearDependentNodes()
    const outletCode = text(field('OutletCode'))
    const invoices = selectedInvoices.value.map((row) => ({ ...row, Code: text(row.code) }))
    if (!outletCode || !invoices.length) {
      // The node stays - it holds the answers and gates the sticky bar - but there is
      // nothing for Layer 2 to refuse either.
      setField('BuildError', '')
      return
    }
    // The shared columns go onto the rows the page holds; the builder never restates them.
    stampPaymentRowsInPageState(pageState, {
      mode: text(field('Mode')) || 'Cash',
      reference: text(field('Reference')),
      username: collectorName.value,
      actorName: collectorName.value,
      comment: ''
    })
    const applied = pageState.applyNodes(buildOutletPaymentCreationNodes({
      selectedOutletCode: outletCode,
      selectedInvoices: invoices,
      rows: rows(),
      withRows: false,
      totalAmount: num(amount.value),
      mode: text(field('Mode')) || 'Cash',
      reference: text(field('Reference')),
      // The logged-in collector and today's date are stamped onto every payment row by the
      // builder, from these two values.
      username: collectorName.value,
      actorName: collectorName.value,
      existingPayments: index.rawPayments.value,
      waiveResidual: field('WaiveResidual', false) === true,
      waiverReason: text(field('WaiverReason')),
      waiverComment: text(field('WaiverComment'))
    }))

    // Why Layer 2 refused, in its own words, so the sticky bar can veto submit with it
    // instead of inventing a second rule.
    setField('BuildError', applied.valid === false ? text(applied.message) : '')
  }

  pageState?.derive([
    { key: 'paymentAdd:outlet', on: { resource: NODE, control: 'OutletCode' }, handler: rebuild },
    { key: 'paymentAdd:rows', on: { resource: NODE, records: true }, handler: rebuild },
    { key: 'paymentAdd:amount', on: { resource: NODE, control: 'Amount' }, handler: rebuild },
    { key: 'paymentAdd:mode', on: { resource: NODE, control: 'Mode' }, handler: rebuild },
    { key: 'paymentAdd:reference', on: { resource: NODE, control: 'Reference' }, handler: rebuild },
    { key: 'paymentAdd:waive', on: { resource: NODE, control: 'WaiveResidual' }, handler: rebuild },
    { key: 'paymentAdd:waiveReason', on: { resource: NODE, control: 'WaiverReason' }, handler: rebuild },
    { key: 'paymentAdd:waiveComment', on: { resource: NODE, control: 'WaiverComment' }, handler: rebuild }
  ])

  return {
    pageState,
    initNode,
    loadSources,
    reseedAmount,
    ui,
    money: (value) => _C(num(value), true),
    allowed: (permissions) => resourceConfig?.allowed?.(permissions) === true,

    MODE_OPTIONS,
    MODE_ICONS,
    waiverReasons,
    modeIconOf: (value) => MODE_ICONS[text(value)] || MODE_ICONS.Other,

    outletCode,
    outletOptions,
    outletInvoices,
    outletBalance,
    selectedCodes,
    selectedInvoices,
    selectedBalance,
    selectedTotal,
    selectedCollected,
    isAllSelected,
    toggleInvoice,
    toggleSelectAll,
    setSelectedCodes,

    amount,
    allocations,
    setAllocation,
    distribute,
    totalAllocated,
    allocationDiff,
    reconcileToAllocations,

    mode,
    reference,

    waiveResidual,
    waiverReason,
    waiverComment,
    canWaiveResidual,
    residualBalance,
    waiverLimit,
    waiverAuditComment,

    receiptLines,
    collectorName,
    collectionDate,

    outletNameOf: (code) => index.outletNameByCode.value.get(text(code)) || text(code),

    step: computed(() => pageState?.meta?.currentStep || 1)
  }
}
