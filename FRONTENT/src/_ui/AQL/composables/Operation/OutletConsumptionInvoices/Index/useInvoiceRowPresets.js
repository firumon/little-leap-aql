import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

/**
 * OutletConsumptionInvoices › Index — the ONE row shape every invoice list uses.
 *
 * Five views render invoices — the two groups inside Near Due, plus Overdue, Pending and
 * High Value — and they all render them IDENTICALLY:
 *
 *     OCINV260000024                     ← caption: which document
 *     MINA PHARMACY                      ← label:   who owes it
 *     2026-08-16 · due by 45 days        ← caption: when, and how late
 *                              [ 426.25 ]← chip:    how much
 *
 * Defined once here rather than five times in five components, because a row that reads
 * differently depending on which pill you arrived through makes the same invoice look like
 * two records (UI_RESOURCE_DOMAIN_LOGIC.md §4 — presentation shared by placement).
 *
 * ── WHY `content` AND NOT `layout` ALONE ──
 * `abstract/List.vue` builds its main column from `layout`, which maps only `label` and
 * `caption` to the two matching props — so a row needing TWO caption lines cannot be
 * expressed by those props. Passing `content` as an explicit array bypasses that mapping and
 * supplies one value per layout slot, while `layout` still decides how each slot is STYLED.
 * The two arrays are positional and must stay the same length.
 *
 * This is presentation, so it lives in `_ui/` (§4). The rows it shapes are already-derived
 * aggregate entries from `useInvoiceIndex` — nothing here recomputes a balance or a date.
 */

const text = (value) => (value == null ? '' : String(value).trim())

/**
 * How late, or how soon, in words.
 *
 * `dueInDays` is negative once the date has passed and `null` when no due date was ever set.
 * The undated case says so plainly rather than rendering "due in null days" or silently
 * dropping the clause — an invoice nobody gave a deadline is a real state, and hiding it
 * would make it indistinguishable from one due today.
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
 * The shared prop bag for a list of invoice aggregate rows.
 *
 * `clickable` and the `click` handler are left to the caller: every list opens the invoice,
 * but the handler belongs to the component that owns the navigation relay.
 */
export function invoiceRowPreset (rows = []) {
  const { _C } = useCurrencyResource()

  return {
    items: Array.isArray(rows) ? rows : [],
    itemKey: 'code',

    // Positional pairs — see the `content` note in the file header.
    layout: ['caption', 'label', 'caption'],
    content: [
      (row) => text(row.code),
      (row) => text(row.outletName) || text(row.outletCode),
      (row) => dateAndDue(row)
    ],

    // The amount as a CHIP rather than plain text: it is the one value on the row a reader
    // scans down the column for, and a chip gives it an edge to find.
    metaLayout: ['chip'],
    chip: (row) => _C(row.balance, true),
    // Red only when the invoice is actually late. Colouring every amount red would make the
    // overdue ones indistinguishable inside the Near Due view, which shows both groups.
    chipColor: (row) => (row.isOverdue ? 'negative' : 'primary'),
    chipOutline: true,

    clickable: true
  }
}

/**
 * The same row, for a SETTLED invoice — paid or cancelled.
 *
 * Two differences, both because the invoice is closed: the chip shows what the document was
 * WORTH rather than its balance (which is zero, and a column of zeroes wastes the row's one
 * figure), and the caption states the outcome instead of a due date that no longer means
 * anything.
 */
export function settledRowPreset (rows = []) {
  const { _C } = useCurrencyResource()

  return {
    ...invoiceRowPreset(rows),
    content: [
      (row) => text(row.code),
      (row) => text(row.outletName) || text(row.outletCode),
      (row) => [text(row.date), row.progress === 'CANCELLED' ? 'cancelled' : 'paid'].filter(Boolean).join(' · ')
    ],
    chip: (row) => _C(row.total, true),
    chipColor: (row) => (row.progress === 'CANCELLED' ? 'grey-6' : 'positive')
  }
}
