import { markRaw } from 'vue'

/**
 * Central dynamic resolver for the modular base field system.
 *
 * Every field type owns a folder under `src/components/_fields/<type>/` holding
 * three explicit SFCs — `Add.vue`, `Edit.vue`, `View.vue`. Container components
 * (FormRecord.vue / ViewRecord.vue) never branch on a field type themselves;
 * they hand the resolved type + render mode to `resolveFieldComponent()` and
 * mount whatever comes back.
 *
 * Resolution:
 *   (type, mode) -> _fields/<type>/<Mode>.vue
 *   missing type OR missing mode file -> _fields/text/<Mode>.vue
 */

// Render modes -> the SFC filename that serves them.
const MODE_FILES = {
  add: 'Add',
  edit: 'Edit',
  view: 'View'
}

export const FALLBACK_TYPE = 'text'
export const FALLBACK_MODE = 'view'

// Schema-authored type synonyms (APP.Resources.UIFields is hand-maintained, so
// the same presentation intent arrives under several spellings).
const TYPE_ALIASES = {
  string: 'text',
  str: 'text',
  input: 'text',
  longtext: 'textarea',
  multiline: 'textarea',
  memo: 'textarea',
  notes: 'textarea',
  url: 'link',
  uri: 'link',
  website: 'link',
  hyperlink: 'link',
  phone: 'tel',
  mobile: 'tel',
  telephone: 'tel',
  attachment: 'file',
  upload: 'file',
  image: 'file',
  timestamp: 'datetime',
  'date-time': 'datetime',
  datetimelocal: 'datetime',
  dropdown: 'select',
  enum: 'select',
  reference: 'select',
  // Array-valued selection. A separate type from `select`, not a flag on it —
  // the two disagree on the shape of `modelValue` (scalar vs array).
  multi: 'multiselect',
  multiselect: 'multiselect',
  multiselection: 'multiselect',
  tags: 'multiselect',
  int: 'number',
  integer: 'number',
  decimal: 'number',
  float: 'number',
  money: 'currency',
  amount: 'currency',
  price: 'currency',
  boolean: 'toggle',
  bool: 'toggle',
  checkbox: 'toggle'
}

// ─── Registry build ──────────────────────────────────────────────────────────
// Eager so resolution is synchronous — a field control must not flash an empty
// cell while an async chunk loads mid-render.
const fieldModules = import.meta.glob('./*/*.vue', { eager: true })

const registry = {}

for (const [path, mod] of Object.entries(fieldModules)) {
  const match = /^\.\/([^/]+)\/(Add|Edit|View)\.vue$/.exec(path)
  if (!match) continue

  const component = mod?.default ?? mod
  if (!component) continue

  const type = match[1].toLowerCase()
  registry[type] = registry[type] || {}
  registry[type][match[2]] = markRaw(component)
}

/**
 * Normalizes a raw schema type into a `_fields` folder name.
 * Unknown types collapse to the `text` fallback.
 */
export function normalizeFieldType (type) {
  const raw = String(type ?? '').trim().toLowerCase()
  if (!raw) return FALLBACK_TYPE
  const aliased = TYPE_ALIASES[raw] || raw
  return registry[aliased] ? aliased : FALLBACK_TYPE
}

/**
 * Resolves a field DEFINITION to its presentation type. Use this wherever only
 * the raw schema entry is available (e.g. ViewRecord's `resolvedFields`, which
 * come straight from `APP.Resources.UIFields`).
 *
 * Header heuristics only apply when the schema carries no meaningful type, so an
 * explicit `type` in UIFields always wins.
 */
export function resolveFieldType (field) {
  if (!field) return FALLBACK_TYPE

  const explicit = normalizeFieldType(field.type)
  if (explicit !== FALLBACK_TYPE) return explicit

  const header = String(field.header || '')
  if (!header) return FALLBACK_TYPE

  // Mirrors useFormFields.mapField so add/edit and view agree on the same type.
  if (/Date$/.test(header)) return 'date'
  if (header.toLowerCase() === 'status') return 'status'

  return FALLBACK_TYPE
}

/**
 * Resolves the SFC for a (type, mode) pair.
 *
 * @param {string} type field type (`link`, `file`, `currency`, ...)
 * @param {string} mode `add` | `edit` | `view`
 * @returns {object} a Vue component — never null (falls back to `text`).
 */
export function resolveFieldComponent (type, mode) {
  const modeKey = MODE_FILES[String(mode ?? '').trim().toLowerCase()] || MODE_FILES[FALLBACK_MODE]
  const typeKey = normalizeFieldType(type)
  return registry[typeKey]?.[modeKey] || registry[FALLBACK_TYPE][modeKey]
}

/** Field types that currently have a folder under `_fields/`. */
export function fieldTypes () {
  return Object.keys(registry)
}

/** True when `type` resolves to a real folder rather than the text fallback. */
export function hasFieldType (type) {
  const raw = String(type ?? '').trim().toLowerCase()
  return !!registry[TYPE_ALIASES[raw] || raw]
}

export function useFieldResolver () {
  return {
    resolveFieldComponent,
    resolveFieldType,
    normalizeFieldType,
    fieldTypes,
    hasFieldType
  }
}
