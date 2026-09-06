import {
  progressOf,
  progressLabel,
  progressColor,
  settledAt,
  daysSince,
  isActiveRow,
  isCancelled
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

/**
 * OutletConsumptions › Index — per-view list row presets.
 *
 * PRESENTATION ONLY (UI_RESOURCE_DOMAIN_LOGIC.md §4). Every predicate, colour and label
 * below is READ from the resource's Layer 2 vocabulary; nothing here decides what a state
 * means, only how its row is arranged.
 *
 * Named PURE exports so the page contract — evaluated outside any component setup — can
 * apply them as function-valued `Props<Identity>` blocks (§5).
 *
 * ── THE MOBILE ROW ──────────────────────────────────────────────────────────────
 *
 * Three things, and deliberately only three: the OUTLET, the DATE, and the state chip.
 *
 * The record code is omitted from every preset here. `OC-000412` identifies the row to the
 * database and to nobody else; a field officer scanning a phone screen recognises "Marina
 * Mall", and spending the row's one strong line on a code pushes the name into a wrap.
 * The code is still on the View page, where there is room to state it.
 *
 * Every suppressed slot is set to explicit `null`, never omitted — `useListStrategy`'s
 * inference is a BASELINE that explicit props layer over, so an omitted key silently
 * re-admits whatever it inferred for this resource (UI_MODULE_DEVELOPER_GUIDE §7.2).
 */

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

/**
 * The outlet's NAME, resolved off the enriched relation.
 *
 * `$outlet` is a non-enumerable getter built by the record enrichment, so it is read by
 * name and never through a spread (§11 rule 1). Falls back to the code only when the
 * relation has not resolved — a row that says `OUT-004` is still better than a blank one.
 */
function outletLabel (row) {
  const entry = asRow(row)
  return text(entry.$outlet?.Name) || text(entry.OutletCode) || 'Unknown outlet'
}

/** `2026-08-15` → `15 Aug 2026`. A blank stays blank rather than becoming "Invalid Date". */
function formatDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

/** "3 days ago" / "Today" — the plain elapsed reading a settled row carries instead of a chip. */
function elapsedLabel (row) {
  const days = daysSince(settledAt(row))
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

/** Newest first — for a settled view, the most recent outcome is the interesting one. */
function newestFirst (rows = []) {
  // `slice()` before sorting: `items` is the store's own array and sorting in place would
  // mutate what every other consumer on the page is reading. `sort` carries references
  // through, so the enriched records survive intact (§11 rule 1).
  return (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
    const left = text(settledAt(a))
    const right = text(settledAt(b))
    return left < right ? 1 : left > right ? -1 : 0
  })
}

/** The three slots every consumption row shares, plus every inferred slot suppressed. */
function baseRow (rows) {
  return {
    items: rows,
    label: (row) => outletLabel(row),
    caption: (row) => formatDate(asRow(row).Date),
    chip: (row) => progressLabel(progressOf(row)),
    chipColor: (row) => progressColor(progressOf(row)),
    // Suppressed, not omitted — see the header note.
    meta: null,
    badge: null,
    metaLabel: null,
    metaCaption: null
  }
}

/**
 * `Recent` — the latest 50 live audits, newest first, whatever state they are in.
 *
 * Cancelled audits are left out: a cancelled audit recorded nothing that stands, so it is
 * not part of "what moved lately?". The cap is a hard 50 for the same reason.
 */
export function recentPreset (rows = []) {
  const live = (Array.isArray(rows) ? rows : []).filter(isActiveRow).filter((row) => !isCancelled(row))
  const sorted = newestFirst(live).slice(0, 50)
  return {
    ...baseRow(sorted),
    caption: (row) => [formatDate(asRow(row).Date), elapsedLabel(row)].filter(Boolean).join(' · '),
    metaLayout: ['chip']
  }
}

/**
 * `Completed` — consumptions that have been invoiced and are finished.
 *
 * Settled history, so: newest first, and the age chip is DROPPED. A colour-coded age is a
 * queue position; on a finished row the same number is history, and only the plain "how
 * long ago" reading survives — carried in the caption beside the date.
 */
export function completedPreset (rows = []) {
  const sorted = newestFirst((Array.isArray(rows) ? rows : []).filter(isActiveRow))
  return {
    ...baseRow(sorted),
    caption: (row) => [formatDate(asRow(row).Date), elapsedLabel(row)].filter(Boolean).join(' · ')
  }
}

/**
 * `Cancelled` — with the reason, which is the only fact that explains the row.
 *
 * The caption states WHY rather than restating the date the label line already implies:
 * a cancelled audit that says nothing is indistinguishable from a data error.
 * `ProgressCancelledBy` is deliberately not surfaced — some `*By` stamps in this app hold
 * a raw user code (`U0001`), which renders as an opaque string nobody can read (§7.2). The
 * actor is resolved on the View page, where it can be looked up.
 */
export function cancelledPreset (rows = []) {
  const sorted = newestFirst((Array.isArray(rows) ? rows : []).filter(isActiveRow))
  return {
    ...baseRow(sorted),
    caption: (row) => {
      const reason = text(asRow(row).ProgressCancelledComment)
      const when = formatDate(asRow(row).Date)
      return reason ? `${when} · ${reason}` : when
    }
  }
}

/** Shared by the two projection `.vue` overrides so their rows read like every other. */
export { outletLabel, formatDate, elapsedLabel }

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionRowPresets () {
  return { recentPreset, completedPreset, cancelledPreset, outletLabel, formatDate, elapsedLabel }
}
