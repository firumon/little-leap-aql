# Content System — Page Schemas & Content Atomicity

> Part of **[﻿# AQL Content Layout & Customization System](UI_CONTENT_SYSTEM.md)**. View/Add/Edit/Action configuration schemas via JS modifiers, and the one-content-one-job rule.

---

## 5. Other Page Configuration Schemas (View/Add/Edit/Action — via JS Modifiers)

The sections below describe the existing Section-level modifier contracts (`Details.js`, `Form.js`, `Content.js` at the page-orchestrator level) that remain unchanged by the `contents:` system above; they operate through `useSectionResolver.js` rather than `useContentResolver.js`.

### 5.1 View Page: Details Card (`Details.js`)
Custom JS logic modifier file created at `src/_ui/[UiName]/components/[scope]/[ResourceName]/View/Details.js`.

#### Details Card Schema (`Details.vue` Props)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `detailsConfig` | `object` | `{}` | Inner configuration for details card: `title`, `columns`, `fields`, `fieldLabels`. |

##### `detailsConfig` Configuration Object:
* `title` (string, default: `'Details'`): Header text.
* `columns` (number, default: `1`): Responsive columns grid (supports `1`, `2`, `3`).
* `fields` (string[]): Explicit list of fields in display order.
* `fieldLabels` (object): Key-value mapping of field headers to custom labels.

#### Example Details Modifier
```javascript
// src/_ui/AQL/components/master/Products/View/Details.js
export default function (props) {
  return {
    ...props,
    detailsConfig: {
      title: 'Product Specifications',
      columns: 2,
      fields: ['Name', 'SkuCode', 'Type', 'Price'],
      fieldLabels: {
        SkuCode: 'Stock Keeping Unit',
        Price: 'MSRP (USD)'
      }
    }
  }
}
```

---

### 5.2 Add, Edit, & Action Forms (`Form.js`)
Custom JS logic modifier file created at `src/_ui/[UiName]/components/[scope]/[ResourceName]/Add/Form.js`, `Edit/Form.js`, or `Action/Form.js`.

#### Form Configuration Schema (`Form.vue` Props)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `formConfig` | `object` | `{}` | Inner configuration details for inputs: `flat`, `bordered`, `class`, `columns`, `hideFields`, `fieldConfigs`, `sections`. |

##### `formConfig` Configuration Object:
* `columns` (number, default: `1`): Default number of columns for fields.
* `hideFields` (string[]): Fields to hide.
* `sections` (object[]): Fields grouped in Collapsible or static sections.
* `fieldConfigs` (object): Specific field definitions.

##### Date Fields
Form inputs of type `'date'` render using [AppDate.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared/AppDate.vue) for masked typing and a custom calendar pop-up.

#### Example Form Modifier
```javascript
// src/_ui/AQL/components/master/Products/Add/Form.js
export default function (props) {
  return {
    ...props,
    formConfig: {
      columns: 2,
      hideFields: ['CreatedBy', 'ModifiedBy'],
      sections: [
        {
          title: 'General Info',
          fields: ['Name', 'SkuCode', 'Price'],
          columns: 2
        },
        {
          title: 'System Settings',
          fields: ['Status', 'TaxRate'],
          collapsible: true,
          collapsed: true
        }
      ],
      fieldConfigs: {
        Price: {
          label: 'Unit price (USD) *',
          placeholder: '0.00',
          type: 'number'
        }
      }
    }
  }
}
```

---

### 5.3 `Create` — The Built-In Create Content Component

[Create.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/Create.vue) (registered content name `Create`, component name `ContentsCreate`) is the framework's default resource-creation content, resolved exactly like `List`/`View` via `contents: ['Create']`:

```javascript
// src/pages/Master/create.js
export default {
  sections: ['PageHeader', 'PageAction'],
  contents: ['Create'],
}
```

`Create` renders the primary resource's input form (`FormRecord`) plus one `FormChild` per eligible child resource (resources whose `ParentResource` equals the active resource) — never a parent-relation form. All input lands directly in the shared `pageState` reactive tree via `setRecord`/`setControls`/`addChild`/`updateChild`; submit is owned entirely by `PageAction` sections. Both components follow a strict **zero-hardcoding contract** — every default label, class, colour, and behaviour is an overrideable prop — and a four-step field-visibility precedence chain: **`showFields` > `hideFields` > `workflowFields`** (with `Status` hidden + seeded `'Active'` by default). Non-schema "custom" fields are routed to `pageState.setControl`/`node.controls`, never `node.record`.

**Full canonical reference — component anatomy, complete prop tables, the visibility precedence chain, `defaultValues`/`fieldProps` function resolution, the three independent override hierarchies (`FormChild<ChildName>`, `FormRecord`, `FormField<Header>` — `_ui/*` only, no framework fallback), whole-content `create.vue`/`create.js` and `update.vue`/`update.js` overrides, `Update.vue`'s hydration lifecycle, and child soft-deletion — lives in [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md).**

---

### 5.4 Order & Visibility Control in View Pages (`Content.js`)

At the page content orchestrator level (`View/Content.js`), a resource custom JS modifier can adjust:
- **`order`**: Array of sections (`'Details'`, `'Parent'`, `'Children'`, `'Audit'`) defining their layout sequence.
- **`hide`**: Array of sections to completely exclude from rendering.

#### Example Content Modifier
```javascript
// src/_ui/AQL/components/operation/OutletConsumptions/View/Content.js
export default function (props) {
  return {
    ...props,
    order: ['Children', 'Details', 'Parent'], // Render children grid first
    hide: ['Audit', 'Parent']                 // Exclude audit trail and parent link cards
  }
}
```

---

## 6. Content Atomicity — one content, one job (STRICT)

> [!IMPORTANT]
> **A content component holds exactly what the page contract assigned it, and nothing
> else.** If one `.vue` renders two things the user thinks about separately, it is two
> contents — each with its own file, its own entry in the contract's `contents` array, and
> its own `Props<Identity>` block.

### 6.1 What "atomic" means here

Atomic is about **one job**, not one control. Do **not** make a content per field, per
toggle, or per card — a form of ten inputs the user fills in one pass is one content.

Split when the blocks answer different questions:

| Same content | Separate contents |
|---|---|
| A card and the empty state it falls back to | The routing decision vs. the line items it governs |
| A list and the drawer that adds rows to it | A count the user enters vs. the invoice priced off it |
| A toggle and the field it reveals | A summary of what happened vs. what to do next |

The test: *could a reader describe this file's job in one short sentence without the word
"and"?* If not, split it. `RestockOptions` (how the restock is routed) and `RestockItems`
(what is in it) each pass; the old combined `RestockReview` did not.

### 6.2 Every content is declared in the page contract

A content is never imported by a sibling content and never rendered as a private child
component. It is resolved by name, so it must be listed:

```javascript
// _ui/{Ui}/pages/{Scope}/{Resource}/Add.js
export default {
  contents: ['Context', 'StockCount', 'SoldReview', 'RestockOptions', 'RestockItems'],

  PropsRestockOptions: { step: 4 },
  PropsRestockItems: { step: 4 }
}
```

Two contents may share one wizard `step` — the step is a screen, the content is a block on
it. Order inside a step is the order in the `contents` array.

### 6.3 Props are supplied by the contract, state is shared by the composable

Give a content a prop for anything the **page** decides — `step`, a title, a variant, a
visibility flag. Supply it from the contract; never hardcode a page-specific value inside
the content, and never reach into a sibling content for it.

Do **not** pass domain data between contents as props. Two contents that work on the same
data both bind to the same `pageState` node, and get their domain answers from that
resource's Layer 2 builders. That is what keeps them independently mountable and
re-orderable — a split that needed props to flow sideways would not be a split at all.

> [!CAUTION]
> A shared **feature composable** is not the way to do this. `OutletConsumptions/Add` used
> to hold one (`useConsumptionWizard.js`, 552 lines) that every step card imported; it grew
> a second copy of the invoice arithmetic and a control array mirroring rows that already
> lived on a node — and the mirror silently stopped reaching the submitted batch. The node
> is the shared state, and Layer 2 is the shared logic. Nothing else is needed.

### 6.4 Where the files live

Page-private contents sit beside their siblings in the page folder
(`_ui/{Ui}/components/{Scope}/{Resource}/{Page}/`), are **not** logged in any registry
(CORE_ARCHITECTURE_RULES §8), and carry no `<style>` block (§7). Anything genuinely reusable
across pages goes to `components/shared/` instead and IS logged.

---

⬑ Back to **[﻿# AQL Content Layout & Customization System](UI_CONTENT_SYSTEM.md)**.
