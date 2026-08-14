import RestockActionButtons from './RestockActionButtons.vue'

/**
 * OutletRestocks › Index › "My Drafts" view — JS modifier (tier CP: resource + page).
 *
 * Carries ONE prop, and that is the whole reason the file exists: `btn` is a COMPONENT
 * value, and a component belongs beside the component it mounts rather than in the page
 * contract. Every other prop for this view — sorting, layout, the row resolvers — lives
 * in `pages/Operation/OutletRestocks/Index.js` as `PropsListDrafts`, because a plain prop
 * bag does not need its own file (UI_MODULE_DEVELOPER_GUIDE.md §8.4).
 *
 * That split is not just tidiness. A JS modifier is invoked ONCE and its result cached by
 * `useContentResolver`, so a modifier returning `items` would freeze them at whatever the
 * store held on the first resolve. A `Props<Identity>` block is re-evaluated with the
 * live props bag on every render. Constants here, anything derived from rows there.
 *
 * `RestockActionButtons` reads the ROW's progress to decide what to offer, so a draft
 * gets Edit + Submit without this file naming either.
 */
export default {
  btn: RestockActionButtons
}
