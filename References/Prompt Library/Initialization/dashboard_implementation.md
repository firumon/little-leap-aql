# Dashboard Data Item Implementation

## Scope boundary

This prompt covers adding, changing, or debugging a dashboard data item and its sheet item. It does NOT cover building a widget — that is in [CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/CONTRACT.md). It does NOT cover Index page summary cards — those are part of the resource UI module system. If the task is about a chart on a resource's own Index page, this is the wrong prompt.

---

## Read these before you touch anything

Read these files in this exact order:

1. [Documents/FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md) — Complete guide to every option by where it lives.
2. [Documents/FEATURE_DASHBOARD_ENGINE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE.md) — The engine hub and flow overview.
3. [Documents/FEATURE_DASHBOARD_ENGINE_DATA.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE_DATA.md) — The data layer (DJS), item descriptors (DBI), controls, and empty rule.
4. [Documents/CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md) — Required before ANY edit under FRONTENT/.
5. [FRONTENT/src/components/widgets/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/REGISTRY.md) — Which preset to pick. Only preset names go in the sheet, never a base name.
6. [FRONTENT/src/components/widgets/WIDGETS.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/WIDGETS.md) — The deep guide hub. Every base with its full prop table, data shape, density tiers, slots and edge cases.
7. [FRONTENT/src/components/widgets/CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/CONTRACT.md) — The rules every widget obeys.
8. The resource's own Data/ folder — Read every file in it, including _shared.js.
9. [Documents/SHARED_UTILITIES_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHARED_UTILITIES_INDEX.md) — Read before you even think about a new helper.

---

## The rules you must obey

1. **One file, one item.** The file name IS the item name.
2. **A leading underscore means a helper, not an item.** Shared constants go in `_shared.js` so two items can never drift apart.
3. **Write the JSDoc block FIRST, before the code.** If you cannot say in plain words what the item is for, the item is not ready to build. The block is required and must never be deleted — see the exception in [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md).
4. **A descriptor is DATA ONLY.** Keys allowed: `name`, `title`, `subtitle`, `caption`, `controls`, `options`, `compute`. No permission, no resource list, no size, no colour. Those live on the sheet item.
5. **Never import a store into a descriptor.** Everything you need is on `ctx`. If `ctx` lacks it, STOP and ask — do not reach around it.
6. **Return `null` when there is nothing to show.** Never return a fake zero row and never return `undefined`.
7. **Match an existing widget's data shape exactly.** Do not invent a shape and then ask for a widget to be changed to fit it. The data shape each base needs is written in WIDGETS.md, under "Data shape" for that base. That is now the only place it is written.
8. **Reuse before you build. This is a MUST, not a preference.**
   Before creating ANY widget, or changing one, read all three widget docs: [REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/REGISTRY.md), [WIDGETS.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/WIDGETS.md) and [CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/CONTRACT.md). There are already 15 bases and 49 presets. Almost every need is already met.
   Work down this list and stop at the first one that works:
   1. Use an existing preset as it is.
   2. Use an existing base with different props. A preset is only a base with props fixed.
   3. Add a new preset — a few lines that fix props on an existing base.
   4. Only if none of the 15 bases can draw it, propose a new base. A new base needs the user's yes first, and must follow CONTRACT.md in full.
   Never copy a widget file to make a small change. Never add a base that overlaps one that exists. Say in your report which step you stopped at and why the steps above it did not work.
9. **Do not add controls to a new item.** They are not wired — see §6 of the canonical doc. An item that needs a control is not buildable yet; say so and stop.
10. **Never give an item the same name as another file in that resource's `_ui` folder**, such as `ListSwitcher` or `ResourceActionEdit`. Matching is case-blind and the wrong file would load. See §9 of the canonical doc.
11. **Never add a helper to core.** `src/composables/core/`, `src/composables/resources/`, `src/utils/`, `src/stores/`, `src/services/`, `src/router/` and the shared component bases are READ-ONLY unless the user says otherwise. Ask BEFORE creating any new file or exported function, with the audit quote [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md) requires.

---

## Every surface a dashboard item touches

| Surface | File | When it applies |
|---|---|---|
| The descriptor | `_resource/<Scope>/<Resource>/Data/<name>.js` | always |
| The assembler | `_resource/<Scope>/<Resource>/Dashboard/index.js` | only when the folder is new |
| Shared constants | `Data/_shared.js` | when two or more items share a rule |
| The live sheet cell | `App.Resources`, `Dashboard` column | always |
| The tenant seed | `GAS/syncAppResources.gs`, beside that resource's `ListViews` | always, or a new tenant gets no dashboard |
| The canonical doc | `Documents/FEATURE_DASHBOARD_ENGINE.md` | when a RULE changes, not when an item is added |

A new item that is not in `syncAppResources.gs` is not finished. It works for this client and silently misses every future one.

---

## How to add a new item

Follow the nine steps in §10 of [Documents/FEATURE_DASHBOARD_ENGINE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE.md). Do not copy those steps here. Copying them would let the two documents drift apart.

Here is what is extra for an agent:
- State clearly which resource and scope you are working in.
- Confirm the resource's scope from the auth payload before you use it in a score example.
- Be careful: `OutletConsumptionInvoices` is `operation`, not `accounts`. Only six resources are `accounts`: `Assets`, `Equity`, `Expenses`, `Liabilities`, `Revenue`, and `TaxTransactions`.

---

## How to change an existing item

Adding a tile means one DBI file and one ARD sheet item. The standard sheet item is only
`{"name":"<dbiFileName>"}`. Put it in the position that sets its order. Any other sheet key is an
optional override; see [FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md)
for the override keys.

Read the JSDoc block first. It tells you what the item promised.
If your change breaks that promise, UPDATE THE BLOCK in the same edit.
A block that no longer matches its code is worse than no block.

## Rules that must not break

- A broken tile is always visible. Hide only a healthy tile that has nothing to say.
- For the tile file and ARD line rule, see [How to change an existing item](#how-to-change-an-existing-item) above. Other keys are optional overrides.
- Layer 1 core files are read-only unless the user says yes. Ask before creating any file or exported function, with the audit quote from `AGENTS.md`.
- Use a Quasar component when one exists. Never rebuild it from `div`s.
- No hidden features. Every option is documented, and every new feature updates its init prompt in the same task.
- One-line, single-use logic stays inline, such as `valueFormat: (v) => v + ' days'`. Only multi-step logic gets a helper, and a reused helper is general.
- No option is special. Widget options such as `valueFormat` and `color` are plain `widgetProps`.
- Docs describe the present. No history.
- Never push or deploy.

If the change needs a different picture, re-read [REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/REGISTRY.md) first — the preset you want probably already exists.

---

## Verification

The build agent has NO browser pane. Never claim a dashboard item works. Report what you changed and what you did not do, and hand the browser checks back.

The person checking in the browser must look at these things:
1. **Count the tiles first.** An empty page reports zero problems and looks like success.
2. **Read the real numbers off the tile.**
3. **Confirm the tile is not showing an error card**, such as "Dashboard Item Not Defined" or "Dashboard Item Failed".

---

## Maintenance rule

**When the engine itself changes — a new descriptor key, a change to ctx, a change to the score table, the override tiers, or controls becoming real — you MUST update Documents/FEATURE_DASHBOARD_ENGINE.md and this prompt in the SAME turn as the code. Neither one may lag behind the code.**

If you hit a bug because this prompt or that doc was missing a rule, say so to the user, name the gap, and ask to fix it — follow the Documentation Gap and Self-Healing rule in [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md).
