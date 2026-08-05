import { h, isVNode, toRaw } from 'vue'

/**
 * Is this value a component DEFINITION (an SFC / defineComponent result)?
 *
 * The test is deliberately object-only. A resolver prop may legitimately be a plain
 * function — `(item) => item.Date` — and so is a Vue *functional* component, so the two
 * are indistinguishable at runtime. SFCs compiled by @vitejs/plugin-vue are always
 * objects, which makes them safe to detect; functional components are therefore NOT
 * supported as prop values. Wrap one in defineComponent() if you need to pass it.
 */
export function isComponentDef (value) {
  return !!value && typeof value === 'object' && !isVNode(value) &&
    !!(value.render || value.setup || value.template || value.__file)
}

/**
 * The single dispatch point for "slot-shaped" props across abstract/ and app/ components.
 *
 * Every render site that offers a caller-overridable cell answers the same three
 * questions in the same order, and this collapses them into one node:
 *
 *   1. Did the caller pass a slot?          → render it, nothing else matters
 *   2. Is the value a component?            → mount it with `:item`, no wrapper
 *   3. Otherwise                            → resolve to a scalar and wrap it
 *
 * Rule 2 is the reason this exists: it lets a `_ui/` JS modifier hand a component
 * straight to a prop (`content: [OverduePill]`, `chip: StatusPill`) instead of forcing
 * a full `.vue` override of the whole list. A `.vue` override swaps the component
 * identity, which remounts the list and kills its row transitions — see the note in
 * abstract/List.vue. A component-valued prop keeps the list mounted.
 *
 * Functional rather than an SFC: this renders once per cell per row, so on a 200-row
 * list an SFC would add ~1000 component instances. A plain function creates none.
 *
 * @prop {Function} slotFn    - the caller's slot, e.g. `slots.btn` (highest priority)
 * @prop {*}        value     - String key | Function(item) | component | VNode | false
 * @prop {*}        is        - default wrapper component when `value` resolves to a scalar
 * @prop {String}   valueProp - put the resolved scalar in this prop of `is`; default slot if unset
 * @prop {*}        item      - the record, passed to resolvers, slots and components alike
 *
 * All remaining attrs (incl. class/style and listeners) fall through to whatever
 * gets rendered.
 */
function Renderable (props, { attrs, slots }) {
  const { slotFn, value, is, valueProp, item } = props

  // 1. A caller-supplied slot always wins.
  //
  // Only `{ item }` is passed — deliberately NOT `attrs`. Existing slot consumers
  // destructure `{ item }`, and spreading presentation attrs (color, outline, class)
  // into slot props would leak this component's internals into their signature.
  if (slotFn) return slotFn({ item })

  // 2. Nothing to render. `false` is the explicit "skip this cell" value used by the
  //    layout→prop mapping in abstract/List.vue.
  if (value === false || value === null || value === undefined || value === '') return null

  // 3. A component definition owns the cell outright — no wrapper, or it would inherit
  //    caption/chip styling the caller then has to fight.
  //
  //    Receives `item` plus class/style ONLY, exactly like the slot branch above.
  //    Spreading the rest would hand it the presentation attrs computed for the DEFAULT
  //    wrapper (color/outline/text-color), and those clobber the component's own props:
  //    a fallthrough `color="primary"` lands on its root and silently beats its own
  //    `:color` binding. class/style are safe because they merge additively.
  //
  //    toRaw() in case the value reached us through a reactive source; passing a proxied
  //    definition to h() warns and costs a proxy walk per row.
  if (isComponentDef(value)) {
    return h(toRaw(value), { item, class: attrs.class, style: attrs.style }, slots)
  }

  // 4. Resolve the value: function → call with item, string → item key lookup, else literal.
  const resolved = typeof value === 'function'
    ? value(item)
    : (item && typeof item === 'object' && value in item) ? item[value] : value

  // A resolver that built its own node (`(ov) => h(QChip, ...)`) is treated like case 3.
  if (isVNode(resolved)) return resolved

  // 5. Wrap the scalar. No wrapper configured → render it bare rather than mounting
  //    `<component :is="null">`, which only produces a warning and a comment node.
  if (!is) return resolved

  return valueProp
    ? h(is, { ...attrs, [valueProp]: resolved })
    : h(is, attrs, { default: () => resolved })
}

Renderable.props = {
  slotFn:    { type: Function, default: null },
  value:     { default: null },
  is:        { default: null },
  valueProp: { type: String, default: null },
  item:      { default: null }
}

// Attrs are spread manually onto whichever branch renders, so auto-inheritance would
// apply them twice.
Renderable.inheritAttrs = false

export default Renderable
