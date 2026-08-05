# AQL Renderable Contract

**Canonical spec for `FRONTENT/src/components/abstract/Renderable.js`** — the single dispatch point for slot-shaped props across `abstract/`, `app/`, `contents/` and `sections/` components.

> [!IMPORTANT]
> **This is a mandatory pre-read when creating or materially changing any `abstract/`, `app/`, `contents/`, or `sections/` component.**
> Any prop a caller might reasonably want to replace with their own markup MUST route through `Renderable` rather than being interpolated directly into a template. A component that renders `{{ resolveProp(x, item) }}` inline is closed to `_ui/` customization and forces a full `.vue` override — which is the exact cost this contract exists to remove.

---

## 1. The Problem It Solves

A `_ui/` tenant customization has two mechanisms (see [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md)):

| Mechanism | What it can do | Cost |
|---|---|---|
| **JS modifier** (`ListOverdue.js`) | Return props only | Cheap — the base component stays mounted |
| **Vue override** (`ListOverdue.vue`) | Anything, incl. slots | Expensive — swaps component identity, remounts the list, kills row transitions |

`useContentResolver` returns **props only** (`modifierProps` merged into `finalProps`); it never passes slots, and the component it mounts (`contents/List.vue`) binds with `v-bind` and no children. So historically, *"I just need a chip instead of a caption here"* — a presentation tweak — forced the expensive path.

`Renderable` closes that gap: **a prop may now be a component definition**, so a JS modifier can hand over a whole cell without a `.vue` override.

```js
// _ui/AQL/components/Operation/OutletVisits/Index/ListOverdue.js
import VisitActionButtons from './VisitActionButtons.vue'

export default function (props, ctx) {
  return {
    layout: ['caption', 'label', 'caption'],
    content: [(ov) => ov.Date, (ov) => ov.$outlet.Name, (ov) => ov.ProgressPlannedComment],
    btn: VisitActionButtons        // ← the whole action cluster, from a .js modifier
  }
}
```

---

## 2. Dispatch Order

`Renderable` answers the same three questions every overridable cell needs, in a fixed order. **First match wins.**

| # | Condition | Renders | Receives |
|---|---|---|---|
| 1 | `slotFn` is set | The caller's slot | `{ item }` |
| 2 | `value` is `false` / `null` / `undefined` / `''` | Nothing (`null`) | — |
| 3 | `value` is a **component definition** | That component, **no wrapper** | `{ item, class, style }` |
| 4 | resolved `value` is a **VNode** | That VNode raw, **no wrapper** | — |
| 5 | otherwise | `value` resolved to a scalar, wrapped in `is` | scalar → `valueProp`, or `is`'s default slot |

Step 4's resolution rule: `Function` → called as `value(item)`; `String` → treated as a key into `item` when present, else used literally; anything else → literal.

**Why steps 3 and 4 skip the wrapper:** a caller handing over a component owns that cell outright. Nesting it inside `MainCaption`/`MetaChip` would make it inherit caption or chip styling it then has to fight.

---

## 3. Props

| Prop | Type | Purpose |
|---|---|---|
| `slotFn` | `Function` | The caller's slot function, e.g. `slots.btn`. Highest priority. Named `slotFn`, not `slot`, so it never reads as a `v-slot:` typo. |
| `value` | any | `String` \| `Function(item)` \| component \| VNode \| `false` |
| `is` | component | Default wrapper for the scalar branch only |
| `valueProp` | `String` | Put the scalar in this prop of `is` (e.g. `"icon"` for `QBtn`); default slot when unset |
| `item` | any | The record. Passed to resolvers, slots and components alike |

`inheritAttrs: false`. Remaining attrs (incl. class/style and listeners) are applied manually to whichever branch renders.

It is a **functional component, not an SFC, on purpose**: it renders once per cell per row, so on a 200-row list an SFC would add ~1000 component instances. A plain function creates none.

---

## 4. Call-Site Patterns

**Value in the wrapper's default slot** — the common case:

```html
<Renderable :slot-fn="slots['content' + i]" :value="contentProp" :item="item"
            :is="getComponentType(i)" :class="getContentClass(i)" />
```

**Value in a named prop** — when the wrapper takes the value as a prop rather than children:

```html
<Renderable :slot-fn="slots.btn" :value="btn" :item="item" :is="QBtn" value-prop="icon"
            flat round dense :color="btnColor(item)" @click.stop="onActionClick(item)" />
```

**Wrapper chosen per layout entry** — `getComponentType()` may return a caller-supplied component, so a `layout` entry can *wrap* the value (distinct from a `content` entry, which *replaces* the cell):

```js
layout: ['caption', MyRowWrapper]      // wraps
content: [OverduePill]                 // replaces
```

---

## 5. Rules When Building a New Component

### 5.1 Route every overridable prop through `Renderable`

Ask, for each prop: *could a tenant want their own markup here?* If yes — it is slot-shaped, and it goes through `Renderable`. Labels, captions, chips, badges, buttons, meta cells and status indicators always qualify.

### 5.2 Widen the prop type to accept `Object`

**This is the step that gets missed.** A component definition is an Object, so a prop declared `[String, Function]` throws:

```
[Vue warn]: Invalid prop: type check failed for prop "metaCaption". Expected String | Function, got Object
```

Declare every `Renderable`-routed prop as `[String, Function, Object]` — and mirror it on **every component in the forwarding chain**. A JS modifier's props land on `contents/List.vue` first and fail validation there before ever reaching `abstract/List.vue`.

Do **not** widen props that still resolve directly (`icon`, `avatar`, all `*Color` props). There the type check is doing real work: a component would pass validation and then render garbage.

### 5.3 Never spread presentation attrs onto a caller's component

Step 3 passes `item` + `class`/`style` **only**. Spreading the rest hands the component the attrs computed for the *default* wrapper, and those **clobber its own props** — Vue's fallthrough merge wins for non-class props, so a fallthrough `color="primary"` lands on the component's root and silently beats its own `:color` binding. `class`/`style` are the exception because they merge additively.

### 5.4 Keep the section gate

`Renderable` returning `null` still leaves the surrounding element. Keep the existing `v-if` on the section (`v-if="hasBtn(item) || slots.btn"`), both to avoid an empty section box and because attrs like `btnColor(item)` are evaluated unconditionally.

### 5.5 Make truthiness checks component-aware

Helpers that test whether a prop is set (`hasMeta`, `hasBtn`, `hasIcon`) must return a component value as-is:

```js
if (isComponentDef(prop)) return prop
```

Without it the string-key branch (`prop in item`) stringifies the component into a bogus lookup.

---

## 6. Contract for the Component You Pass

A component used as a prop value receives exactly one prop:

```js
const props = defineProps({ item: { type: Object, required: true } })
```

- **`item`, not a spread.** `v-bind="record"` iterates own *enumerable* keys, and the enriched record's relation getters (`$outlet`, `_Parents`) are **non-enumerable** — a spread silently drops them. See `AQL_PAGE_AND_SECTION_SYSTEM.md` §1.3.3.
- **`provide`/`inject` work normally.** The component mounts inside the host's tree, so `inject('resourceRecord')` / `'resourceConfig'` / `'pageState'` reach the same providers a `.vue` override would. Prefer `inject` inside the component over the `ctx` argument handed to the modifier, which is a one-time snapshot.
- **`item` is whatever the host binds.** Resolvers are called as `value(item)`, so in a host whose resolvers take a different context object, bind `:item` to that object and the contract still holds.
- **Adapt, don't reimplement.** If framework logic already exists for the job, wrap it. `VisitActionButtons.vue` contributes only the `item` → `record` binding and the escalation order; all gating and dispatch stay in `useAdditionalActions`.

---

## 7. Modifier Authoring Notes

- **Pass the component bare** — `btn: VisitActionButtons`. No `markRaw`, no `h()`, no arrow wrapper. `modifierProps` is a `shallowRef` in `useContentResolver.js` precisely so component definitions are never deep-proxied; `Renderable` also calls `toRaw()` defensively.
- **If you build VNodes by hand**, the `h()` call must be *inside* the resolver arrow. The exported modifier function runs **once** and its result is cached — a VNode built at that level would be one node shared by every row, which corrupts patching.

  ```js
  content: [(ov) => h(Pill, { visit: ov })]   // correct — per row, per render
  ```
- **Co-located helper components** are globbed into `customUiRegistry` but inert, because lookups only probe `${...}/${contentKey}.vue`. Do not name one after a real content key (`List.vue`, `Form.vue`, `ListOverdue.vue`) or it silently becomes an override.

---

## 8. Known Limits

| Limit | Detail |
|---|---|
| **No functional components as values** | `isComponentDef` is object-only by necessity: a resolver `(item) => item.Date` and a functional component are both plain functions and cannot be told apart. Wrap in `defineComponent()`. |
| **Multi-branch props don't collapse** | `avatar` selects between `avatar` / `avatarLabel` / `icon` *before* resolving a value, so it is not a single value + wrapper. It needs its own resolver feeding `:value`. |
| **Attrs evaluate unconditionally** | `:color="btnColor(item)"` runs even when a slot replaces the cell. Cheap normally; keep the section `v-if` if a host's attrs are expensive. |
| **Row click suppression** | In `abstract/List.vue`, `isItemClickable` is `props.clickable && !props.btn && !slots.btn` — setting `btn` (component or not) makes rows non-clickable. Intended, but a visible behaviour change when adding buttons to a previously navigable list. |

---

## 9. Current Adopters

| Component | Sites |
|---|---|
| `abstract/List.vue` | content loop, meta loop, btn section |

`components/shared/AqlList.vue` is a near-duplicate of `abstract/List.vue` (its own `getComponentType`) that has **not** adopted this contract, and still backs the `#content2`/`#empty` slots on several pages. Its list props are deliberately left un-widened so they don't advertise support it lacks. Converging the two is open work.

---

## Maintenance Rule

Update this document when:
- the dispatch order or prop surface of `Renderable.js` changes
- a new component adopts the contract (add it to §9)
- a new limit or gotcha is found
- the `_ui/` resolution chain changes in a way that affects how modifier props reach a render site
