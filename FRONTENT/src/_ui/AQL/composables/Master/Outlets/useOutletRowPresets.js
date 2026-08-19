import {
  ACTIVITY_STREAMS,
  ageInDays,
  activityColor,
  activityLabel
} from 'src/_resource/Master/Outlets/composables/useOutletActivity'

/**
 * Outlets — the ONE row shape every outlet list in the module uses.
 *
 * All six views list the same kind of thing — an outlet — so they get one presentation, and
 * a row reads identically whichever pill you arrived through, on the Index or on the Operation
 * Hub. What varies between views is only WHICH date the trailing chip is measuring:
 *
 *     MINA PHARMACY                        ← label:   the outlet
 *     Dubai · Al Barsha                    ← caption: where it is
 *     Last restock 3 days ago              ← caption: why it is in THIS queue
 *                          [ 3 days ago ]  ← chip:    that same age, banded by colour
 *
 * A view keyed to one stream (`RecentlyPaid`) measures that stream; the two directory views
 * measure overall activity across all five. Both go through the same builder, so the chip on
 * an outlet in "Recently Paid" and the chip on the same outlet in "All Outlets" are read from
 * one scale and one wording function — both owned by the domain layer
 * (UI_MODULE_DEVELOPER_GUIDE.md §4.5).
 *
 * NO ROW ICONS. Every row of every list here is an outlet; a storefront glyph repeated down
 * the column carries no information and takes the width the location line needs.
 *
 * This is presentation, so it lives in `_ui/` (UI_RESOURCE_DOMAIN_LOGIC.md §4). The rows it
 * shapes are already-derived summaries from `useOutletIndex`; nothing here recomputes an age.
 */

const text = (value) => (value == null ? '' : String(value).trim())

const STREAM_LABELS = Object.fromEntries(
  ACTIVITY_STREAMS.map((stream) => [stream.key, stream.label])
)

/** "Dubai · Al Barsha" — whichever of the three location levels the tenant actually fills. */
export function locationLine (summary) {
  return [summary?.province, summary?.city, summary?.area]
    .map(text)
    .filter(Boolean)
    .join(' · ') || 'No location recorded'
}

/**
 * The age this row is being judged by, in days.
 *
 * `stream` names one of the five activity streams; omitting it measures overall activity.
 * `null` means the event never happened, which every consumer below renders as "Never"
 * rather than collapsing it into "today".
 */
export function rowAgeDays (summary, stream) {
  if (!summary) return null
  if (!stream) return summary.lastActivityDays ?? null
  return ageInDays(summary.streams?.[stream]?.lastAt)
}

/** "Last payment 3 days ago" / "No payment recorded" — the caption stating why the row is here. */
export function rowReason (summary, stream) {
  const days = rowAgeDays(summary, stream)
  const noun = stream ? STREAM_LABELS[stream]?.toLowerCase() : 'activity'
  if (days === null) return `No ${noun} recorded`
  return `Last ${noun} ${activityLabel(days).toLowerCase()}`
}

/**
 * The shared prop bag for a list of outlet summary rows.
 *
 * @param {Array}  rows     already-filtered, already-sorted summaries from Layer 2
 * @param {Object} options
 * @param {string} [options.stream]   which activity stream the chip measures; omit for overall
 * @param {string} [options.keyword]  the live filter term, so the empty state can say WHY
 * @param {string} [options.emptyText] this queue's own empty caption, used when nothing is typed
 * @param {string} [options.emptyIcon] the icon that caption sits under
 * @param {string} [options.emptyIconColor] its tint, for a queue whose emptiness is good news
 */
export function outletRowPreset (rows = [], {
  stream = null,
  keyword = '',
  emptyText = '',
  emptyIcon = 'storefront',
  emptyIconColor = ''
} = {}) {
  // A search that matched nothing and a queue that is genuinely empty look identical on
  // screen and mean opposite things — one is a typo, the other is the answer. The empty
  // state has to distinguish them, so it is built here rather than hardcoded per view.
  const searching = !!String(keyword || '').trim()

  return {
    items: Array.isArray(rows) ? rows : [],
    itemKey: 'code',

    emptyText: searching
      ? `No outlet in this view matches “${String(keyword).trim()}”.`
      : emptyText,
    emptyIcon: searching ? 'search_off' : emptyIcon,
    // "Nothing has gone quiet" is good news and should not be delivered in the same grey as
    // "your search found nothing" (§10.4). `NoUpdates` is the only queue here whose emptiness
    // is a result rather than an absence, so it is the only one that passes a tint.
    emptyIconColor: searching ? 'grey-4' : (emptyIconColor || 'grey-4'),

    // Positional pairs — `abstract/List.vue` maps only `label`/`caption` from `layout`, so a
    // row needing TWO caption lines supplies `content` explicitly and lets `layout` decide
    // only how each slot is styled. The two arrays must stay the same length.
    layout: ['label', 'caption', 'caption'],
    content: [
      (row) => text(row.name) || text(row.code),
      (row) => locationLine(row),
      (row) => rowReason(row, stream)
    ],

    // The age as a chip: it is the one value a reader scans the column for, and the chip
    // gives it an edge to find. Outlined, because a screen of these is a SCALE — a wall of
    // solid colour reads as a wall of alarms (§7.2).
    metaLayout: ['chip'],
    chip: (row) => activityLabel(rowAgeDays(row, stream)),
    chipColor: (row) => activityColor(rowAgeDays(row, stream)),
    chipOutline: true,

    // Suppressed, not omitted: an omitted key re-admits whatever the list strategy inferred
    // for this resource, which is not "off" (§7.2).
    meta: null,
    metaLabel: null,
    metaCaption: null,
    badge: null,
    icon: null,

    clickable: true
  }
}
