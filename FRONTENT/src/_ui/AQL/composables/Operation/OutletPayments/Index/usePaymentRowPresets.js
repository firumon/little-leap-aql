import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

/**
 * OutletPayments › Index — the TWO row shapes every list on this page uses.
 *
 * The page shows two different kinds of thing, and each has exactly one presentation:
 *
 *   INVOICE QUEUES (Near Due, Overdue, Pending, High Value)
 *       MINA PHARMACY                       ← label:   who owes it
 *       OCINV260000024                      ← caption: which document
 *       2026-08-16 · due by 45 days         ← caption: when, and how late
 *                          [ 426.25 ] [ + ] ← chip: balance, button: record a payment
 *
 *   HISTORY (Collections, Cancelled)
 *       MINA PHARMACY                       ← label:   who paid
 *       2026-08-16 • firose • Cash          ← caption: when, who took it, how
 *                                  426.25   ← meta:    what was collected
 *
 * Defined once here rather than six times in six components, because a row that reads
 * differently depending on which pill you arrived through makes the same record look like two
 * (UI_RESOURCE_DOMAIN_LOGIC.md §4 — presentation shared by placement).
 *
 * ── WHY `content` AND NOT `layout` ALONE ──
 * `abstract/List.vue` builds its main column from `layout`, which maps only `label` and
 * `caption` to the two matching props — so a row needing TWO caption lines cannot be expressed
 * by those props. Passing `content` as an explicit array bypasses that mapping and supplies one
 * value per layout slot, while `layout` still decides how each slot is STYLED. The two arrays
 * are positional and must stay the same length.
 *
 * NO ROW ICONS anywhere. A receipt glyph repeated down every row of a list whose every row is
 * a receipt carries no information — it is decoration occupying the space the figure needs.
 *
 * This is presentation, so it lives in `_ui/` (§4). The rows it shapes are already-derived
 * aggregate entries from `useOutletPaymentIndex`; nothing here recomputes a balance or a date.
 */

const text = (value) => (value == null ? '' : String(value).trim())

/**
 * How late, or how soon, in words.
 *
 * `dueInDays` is negative once the date has passed and `null` when no due date was ever set.
 * The undated case says so plainly rather than rendering "due in null days" — an invoice
 * nobody gave a deadline is a real state, and hiding it would make it indistinguishable from
 * one due today.
 */
export function dueText (row) {
  const days = row?.dueInDays
  if (days === null || days === undefined) return 'no due date'
  if (days < 0) return `due by ${Math.abs(days)} days`
  if (days === 0) return 'due today'
  return `due in ${days} days`
}

/** The row's second caption: when it was raised, and where that leaves it. */
export function dateAndDue (row) {
  return [text(row?.date), dueText(row)].filter(Boolean).join(' · ')
}

/**
 * The shared prop bag for a list of OPEN INVOICE aggregate rows.
 *
 * The `#btn` slot is left to the caller: every queue records a payment, but the button is
 * permission-gated and the handler belongs to the component that owns the navigation relay.
 */
export function invoiceQueuePreset (rows = []) {
  const { _C } = useCurrencyResource()

  return {
    items: Array.isArray(rows) ? rows : [],
    itemKey: 'code',

    // Positional pairs — see the `content` note in the file header.
    layout: ['label', 'caption', 'caption'],
    content: [
      (row) => text(row.outletName) || text(row.outletCode),
      (row) => text(row.code),
      (row) => dateAndDue(row)
    ],

    // The balance as a CHIP rather than plain text: it is the one value on the row a collector
    // scans down the column for, and a chip gives it an edge to find.
    metaLayout: ['chip'],
    chip: (row) => _C(row.balance, true),
    // Red only when the invoice is actually late. Colouring every balance red would make the
    // overdue ones indistinguishable inside the Near Due view, which shows both groups.
    chipColor: (row) => (row.isOverdue ? 'negative' : 'primary'),
    chipOutline: true
  }
}

/**
 * The shared prop bag for a list of PAYMENT RECEIPT aggregate rows — collected or cancelled.
 *
 * NO PROGRESS CHIP. The active switcher pill already states which of the two lists this is, so
 * a "CANCELLED" badge on every row of the Cancelled view is a caption repeating its own
 * heading. The amount takes the meta column instead, which is what a reader is actually there
 * for.
 */
export function paymentHistoryPreset (rows = []) {
  const { _C } = useCurrencyResource()

  return {
    items: Array.isArray(rows) ? rows : [],
    itemKey: 'code',

    label: (row) => text(row.outletName) || text(row.outletCode),
    caption: (row) => [
      text(row.date),
      text(row.username),
      text(row.mode)
    ].filter(Boolean).join(' • '),

    metaLayout: ['label'],
    metaLabel: (row) => _C(row.amount, true),

    clickable: true
  }
}
