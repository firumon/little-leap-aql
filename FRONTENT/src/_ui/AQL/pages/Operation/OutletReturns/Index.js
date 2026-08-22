import {
  completedPreset,
  cancelledPreset
} from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnRowPresets'

/**
 * OutletReturns › Index — page contract (tier CP: resource + page specific).
 *
 * The page is a reconciliation LEDGER. It answers, in descending order of urgency: what is
 * still owed and to whom (`MetricCards`), where the pipeline is stuck (`WorkflowFunnel`),
 * then the work itself (`FilterInput`, `ListSwitcher`, `List`). Both widgets hide
 * themselves when they have nothing to report, so a tenant with no returns sees a bare
 * list rather than a wall of zeroes.
 *
 * ── WHY THERE IS NO `AgeingBuckets` OR `LinearProgress` HERE ──
 * Not every module uses every widget (§0). An ageing scale measures HUMAN friction in a
 * queue somebody is supposed to clear on a cadence; a return waits on an invoice cycle or a
 * delivery run, so its age measures the billing calendar rather than anyone's delay, and a
 * red "9 days" band would be an alarm nobody can act on. A completion ratio has the same
 * problem: its denominator would be every return ever raised, which §9.2 excludes as an
 * all-time total. Neither is built rather than built and quietly misleading.
 *
 * ── THE FIVE LIST VIEWS ──
 *   Submitted                     still moving — oldest first, the work queue
 *   Awaiting Invoice Adjustment   the credit is owed — oldest first
 *   Awaiting Warehouse Receipt    the stock is owed — oldest first
 *   Completed                     settled — newest first
 *   Cancelled                     voided — newest first
 *
 * THE NAMES ARE NOT THIS FILE'S TO CHOOSE. `useListViews` auto-generates one view per
 * `Progress` value for an operation-scope resource, `ListSwitcher` renders whatever that
 * produces, and `contents/List.vue` then resolves `List${toPascalCase(viewName)}` — both
 * for a `.vue` override and for a `PropsList<Name>` block. A name that matches no live view
 * is simply never reached, and its list silently falls back to the INFERRED row shape.
 *
 * That is exactly what happened to the `PropsListOpen` / `PropsListCancelled` pair that
 * used to sit here against views called `Submitted` / `Awaiting Invoice Adjustment` /
 * `Awaiting Warehouse Receipt` / `Completed` / `Cancelled`: only `Completed` ever matched,
 * which is why only that one list showed this module's row shape. Check the switcher before
 * naming a block.
 *
 * The three QUEUE views also need rows the auto filter would have already thrown away, so
 * they are `.vue` overrides rather than blocks — `useReturnIndexContext` has the reasoning.
 *
 * They are configured as `Props<Identity>` blocks rather than standalone `List<View>.js`
 * modifier files: each is a plain prop bag with no component value and no template, and a
 * plain prop bag belongs in the page contract where the whole page's list behaviour reads
 * in one place (§5.3).
 *
 * Each block is a FUNCTION, so it is evaluated with the live props bag on every read and
 * receives the active view's already-filtered `items` — which is what lets it re-filter and
 * re-sort them. A static object could not see the rows, and a JS modifier (resolved once,
 * then cached) would freeze them at whatever the store held on first render.
 *
 * ── NO ROW ACTION CLUSTER ──
 * No view carries a `btn`, so `contents/List.vue`'s default click handler opens the View
 * page and the whole row stays the tap target. What a return needs next is decided on its
 * View page, where both tracks are visible — see the note in `useReturnRowPresets.js`.
 *
 * The page keeps its reload control: unlike a form, nothing here is owned by `pageState`,
 * so refreshing costs the reader nothing (§5.5).
 */
export default {
  sections: [
    'PageHeader',
    'MetricCards',
    'WorkflowFunnel',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Returns'
  },

  /**
   * Every widget spaces itself on the PAGE's own gutter rather than its own fallback.
   *
   * `.aql-page-body` sets the rhythm BETWEEN sections, but a section rendering its own
   * children (a card stack, a grouped list) spaces those from a `gutter` prop, and with none
   * supplied it falls back to `_config`'s `gutterFallback` — a different value from
   * `gutterDefault`, on purpose (§10.2). Broadcasting the live token keeps the inside of a
   * widget in step with the gaps around it. The whole BLOCK is the function, never one key
   * inside it (§5.2).
   */
  PropsSection: (pageProps) => ({ gutter: pageProps.gutter }),

  // Only the two SETTLED views are prop blocks. The three queue views are `.vue` overrides
  // under `Index/`, because their membership cannot be a narrowing of the rows the resolver
  // hands them — see `useReturnIndexContext`.
  PropsListCompleted: (props) => completedPreset(props.items),
  PropsListCancelled: (props) => cancelledPreset(props.items)
}
