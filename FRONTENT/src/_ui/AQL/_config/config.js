/**
 * AQL UI — design tokens.
 *
 * The machine-readable half of this UI's visual contract. Every component under
 * `_ui/AQL/` binds to these values instead of hardcoding a class string, a
 * millisecond count or a pixel size, so retuning the UI is a one-file change.
 *
 * The human half — what each token means, why it holds this value, and which
 * decisions are AQL's rather than the framework's — is `config.md` beside this
 * file. Read that before changing a value here.
 *
 * A second UI (`_ui/LittleLeap/`, `_ui/LP/`, …) ships its own `_config/` with the
 * same key names and its own values. Nothing outside `_ui/{Ui}/_config/` may
 * decide any of these; a module-level override is exactly the divergence the
 * theme-uniformity rule forbids.
 *
 * Canonical spec:
 *   Documents/UI_MODULE_DEVELOPER_GUIDE.md §10
 */

export default {
  // ─── Card shell ─────────────────────────────────────────────────────────────
  // Applied as `<q-card flat bordered :class="cardClass">`. `flat` drops Quasar's
  // own shadow so the class's shadow is the only one; `bordered` supplies the
  // hook the class refines.
  cardClass: 'page-card aql-premium-gradient-card',

  // ─── Row grammar ────────────────────────────────────────────────────────────
  // The label/value grid every detail card is built from. Never rebuild these
  // from raw `row`/`col`.
  detailGridClass: 'aql-detail-grid',
  detailLineClass: 'aql-detail-line',
  detailKeyClass: 'aql-detail-key',
  detailValClass: 'aql-detail-val',
  // Added to a detail line to opt it into the staggered entrance below.
  detailRowClass: 'aql-detail-row',

  // A flex child that must WRAP its text rather than push its siblings out of the
  // row. Needed on any column holding a name of unknown length that sits beside
  // a fixed-width figure or button cluster.
  flexWrapTextClass: 'aql-flex-wrap-text',

  // ─── Motion ─────────────────────────────────────────────────────────────────
  // Per-row entrance delay. Stacked cards animate in step only if every one of
  // them uses the same interval. All motion is disabled under
  // `prefers-reduced-motion: reduce` in custom.scss.
  rowStaggerMs: 40,

  // ─── Spacing ────────────────────────────────────────────────────────────────
  // `pageProps.gutter`'s own default, supplied by the page resolver.
  gutterDefault: 'xs',
  // A component's DEFENSIVE fallback for standalone use outside page-driven
  // resolution, where `gutter` is absent entirely. Deliberately not equal to
  // `gutterDefault` — the two serve different purposes.
  gutterFallback: 'sm',

  // ─── Buttons ────────────────────────────────────────────────────────────────
  // Primary/committing action buttons: the sticky bar's submit, and any one-click
  // action that commits or computes something for the whole page.
  primaryActionBtnClass: 'aql-form-action-btn',
  primaryActionBtnProps: { glossy: true, push: true },

  // A row's action cluster: one presentation for every button in it, so View,
  // Edit and workflow actions read as one control at one scale.
  rowActionBtnProps: { flat: true, round: true, dense: true, size: 'md' },

  // Minimum hit area for an icon-only control, in px. Below this a control stops
  // being reliably tappable on a phone.
  //
  // `tapTargetStyle` is the form components actually bind (`:style="ui.tapTargetStyle"`),
  // so the number is never repeated as a literal in a template. A `flat round dense`
  // Quasar button already clears it; a stripped-down stepper or bare icon does not.
  minTapTargetPx: 40,
  tapTargetStyle: { minWidth: '40px', minHeight: '40px' },

  // ─── Empty / loading shells ─────────────────────────────────────────────────
  emptyIconSize: '40px',
  emptyIconColor: 'grey-4',
  emptyTitleClass: 'text-subtitle1 text-weight-bold text-grey-6',
  emptyCaptionClass: 'text-caption text-grey-6',

  // ─── Layout limits ──────────────────────────────────────────────────────────
  // Grouped/repeating controls rendered as columns wrap after this many per row.
  maxControlsPerRow: 3,

  // ─── Emphasis ───────────────────────────────────────────────────────────────
  // At most ONE card per page may break the neutral shell, and only when it asks
  // the reader to do something. This is the tint it uses.
  accentCardClass: 'bg-orange-1',
  accentBorderStyle: { borderLeft: '4px solid var(--q-orange, #ff9800)' }
}
