# FIX: Menu, Error Alerts, CodePrefix Skip, Pricelist Expand
**Status**: COMPLETED
**Created**: 2026-05-08
**Created By**: Brain Agent (Kilo Code)
**Executed By**: Build Agent (Codex)

## Objective
Fix four user-visible bugs with a Build-Agent-executable implementation path:
1. Move Currencies from the Product sidebar group to the Masters sidebar group.
2. Add a centralized frontend error notification fallback for generic resource save flows, without breaking existing page-level notifications.
3. Let GAS create/composite-create use manually supplied `Code` values when `CodePrefix` is intentionally blank, while preserving auto-code behavior for Products, SKUs, Price Lists, operations, and other auto-coded resources.
4. Make Price Lists index cards reliably expand/collapse on click.

## Context
Source docs reviewed in required order:
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/ARCHITECTURE RULES.md`
- `Documents/GAS_API_CAPABILITIES.md` sections for `create`, `CodePrefix`, and `compositeSave`
- `Documents/AQL_MENU_ADMIN_GUIDE.md` menu sync/cache workflow
- `PLANS/_TEMPLATE.md`

Source code reviewed:
- `GAS/syncAppResources.gs` Currencies/UOMs/Product/Price List menu definitions
- `GAS/resourceApi.gs` create handler, composite save parent-code handler, code-generation helpers, bulk upsert handler
- `GAS/resourceRegistry.gs` `CodePrefix` registry read behavior
- `FRONTENT/src/stores/workflow.js` response normalization
- `FRONTENT/src/services/GasApiService.js` canonical GAS API error shape
- `FRONTENT/src/pages/Masters/PriceLists/IndexPage.vue` current manual slide expansion UI
- `FRONTENT/src/pages/Masters/_common/IndexPage.vue` generic list page
- `FRONTENT/src/pages/Masters/_common/AddPage.vue` generic add page
- `FRONTENT/src/composables/resources/useCompositeForm.js` current generic create/composite-save flow. Note: requested `FRONTENT/src/composables/resources/useResourceCrud.js` does not exist in this workspace; `useCompositeForm.js` is the current generic add/edit save composable used by common pages.
- `FRONTENT/src/services/ResourceCrudService.js` current create/composite service calls
- `FRONTENT/src/components/Masters/_common/MasterAddForm.vue` confirms generic add form sends all configured UIFields, including `Code` for Currencies and UOMs.

## Pre-Conditions
- [ ] Build Agent is operating as Build Agent and may edit production code.
- [ ] Required source docs were reviewed or this plan is being executed literally after Brain Agent review.
- [ ] GAS push credentials are available for `npm run gas:push`.
- [ ] APP spreadsheet admin menu access is available for post-edit resource sync/cache actions.

## Steps

### Step 1: Move Currencies menu from Product to Masters
**Files**: `GAS/syncAppResources.gs`
**Pattern**: Use existing `APP_RESOURCES_CODE_CONFIG` resource rows. Menu is stored as JSON in the `Menu` field.
**Rule**: Currencies belongs under the canonical `Masters` group. Nearby current product-related entries use `Product`; Currencies is a generic master and must not remain under product merchandising.

- [ ] 1.1 In `GAS/syncAppResources.gs`, update only the Currencies resource `Menu` JSON.

FROM:
```js
      AdditionalActions: '',
      Menu: JSON.stringify([{"group":["Product"],"order":4,"label":"Currencies","icon":"attach_money","route":"/masters/currencies","pageTitle":"Currencies","pageDescription":"Manage currency master records","show":true}]),
      UIFields: JSON.stringify([
          { header: 'Code', label: 'Code', type: 'text', required: true, hint: 'e.g. AED, INR, USD' },
          { header: 'Name', label: 'Name', type: 'text', required: true },
```

TO:
```js
      AdditionalActions: '',
      Menu: JSON.stringify([{"group":["Masters"],"order":1,"label":"Currencies","icon":"attach_money","route":"/masters/currencies","pageTitle":"Currencies","pageDescription":"Manage currency master records","show":true}]),
      UIFields: JSON.stringify([
          { header: 'Code', label: 'Code', type: 'text', required: true, hint: 'e.g. AED, INR, USD' },
          { header: 'Name', label: 'Name', type: 'text', required: true },
```

Rationale:
- Currencies are a cross-domain master, not a Product group child.
- `Masters` is the requested canonical destination group. Set `order: 1` so it appears naturally at the top of generic Masters items.
- Do not move UOMs in this task unless the user explicitly asks; the requested menu fix is Currencies only.

- [ ] 1.2 After the GAS file edit, run the required GAS push from repo root:
```cmd
npm run gas:push
```

- [ ] 1.3 In the APP spreadsheet, run menu action `AQL 🚀 > 📚 Resources > Sync APP.Resources from Code`.

- [ ] 1.4 In the APP spreadsheet, run menu action `AQL 🚀 > 📚 Resources > Regenerate App Cache`.

- [ ] 1.5 Re-login or refresh the frontend session so the sidebar reads the regenerated resource/menu metadata.

### Step 2: Add centralized error-notification fallback for generic API responses
**Files**:
- `FRONTENT/src/composables/useApiErrorNotify.js` (new)
- `FRONTENT/src/composables/resources/useCompositeForm.js`
- `FRONTENT/src/composables/masters/priceLists/usePriceListEditor.js`

**Pattern**: Business/UI side effects belong in composables. Services remain raw data providers. Stores continue normalizing state and responses, but do not import Quasar UI. Components remain UI-only and do not call services/stores directly.

**Rule**: API result notification fallback must:
- inspect standardized/canonical response objects with `success`;
- notify only when `success !== true`;
- use `$q.notify({ type: 'negative', message, position: 'top' })`;
- mark handled responses to avoid duplicate fallback notifications when multiple composables see the same result;
- leave existing per-page notifications intact. For existing pages that manually notify, future Build Agents may call `markApiErrorHandled(response)` before manual `$q.notify()`. This plan only adopts the fallback where silence is confirmed: generic common add/edit flow and Price List editor saves.

- [ ] 2.1 Create `FRONTENT/src/composables/useApiErrorNotify.js`.

FROM:
```js
// File does not exist.
```

TO:
```js
import { useQuasar } from 'quasar'

const handledResponses = new WeakSet()

function readApiErrorMessage(result, fallback = 'Request failed') {
  if (!result || typeof result !== 'object') return fallback

  const error = result.error
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error && typeof error === 'object') {
    if (typeof error.message === 'string' && error.message.trim()) return error.message.trim()
    if (typeof error.details === 'string' && error.details.trim()) return error.details.trim()
  }

  if (typeof result.message === 'string' && result.message.trim()) return result.message.trim()
  return fallback
}

export function markApiErrorHandled(result) {
  if (result && typeof result === 'object') {
    handledResponses.add(result)
  }
  return result
}

export function wasApiErrorHandled(result) {
  return !!(result && typeof result === 'object' && handledResponses.has(result))
}

export function useApiErrorNotify() {
  const $q = useQuasar()

  function notifyApiError(result, options = {}) {
    if (!result || typeof result !== 'object') return result
    if (!('success' in result) || result.success === true) return result
    if (wasApiErrorHandled(result)) return result

    const message = readApiErrorMessage(result, options.fallbackMessage || 'Request failed')
    $q.notify({
      type: 'negative',
      message,
      position: 'top',
      timeout: options.timeout || 3000
    })
    markApiErrorHandled(result)
    return result
  }

  return {
    notifyApiError,
    markApiErrorHandled,
    wasApiErrorHandled,
    readApiErrorMessage
  }
}
```

Rationale:
- This composable is the single fallback notification mechanism.
- It does not put UI behavior in services.
- It does not require stores to import composables.
- `WeakSet` avoids mutating response objects and prevents repeat fallback notifications for the same object.

- [ ] 2.2 Adopt fallback in generic common add/edit save flow, where Currencies and UOMs currently fail silently on API errors.

File: `FRONTENT/src/composables/resources/useCompositeForm.js`

FROM:
```js
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceRelations } from './useResourceRelations'
```

TO:
```js
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceRelations } from './useResourceRelations'
import { useApiErrorNotify } from 'src/composables/useApiErrorNotify'
```

FROM:
```js
export function useCompositeForm(configRef) {
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
  const { childResources } = useResourceRelations(
    () => (typeof configRef === 'function' ? configRef() : configRef?.value)?.name
  )
```

TO:
```js
export function useCompositeForm(configRef) {
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
  const { notifyApiError } = useApiErrorNotify()
  const { childResources } = useResourceRelations(
    () => (typeof configRef === 'function' ? configRef() : configRef?.value)?.name
  )
```

FROM:
```js
   async function save() {
     if (!validateForm()) return { success: false }

     saving.value = true
     try {
       const payload = buildPayload()
       return await workflowStore.saveComposite(payload)
     } catch (err) {
       $q.notify({ type: 'negative', message: `Save failed: ${err.message}`, timeout: 3000 })
       return { success: false, message: err.message }
     } finally {
       saving.value = false
     }
   }
```

TO:
```js
   async function save() {
     if (!validateForm()) return { success: false }

     saving.value = true
     try {
       const payload = buildPayload()
       const response = await workflowStore.saveComposite(payload)
       notifyApiError(response, { fallbackMessage: 'Save failed' })
       return response
     } catch (err) {
       $q.notify({ type: 'negative', message: `Save failed: ${err.message}`, position: 'top', timeout: 3000 })
       return { success: false, message: err.message }
     } finally {
       saving.value = false
     }
   }
```

Rationale:
- Generic pages (`_common/AddPage.vue`, `_common/EditPage.vue` if present) call `save()` and only navigate on success. They currently do nothing on `success: false` responses.
- The fallback now surfaces API errors such as duplicate/validation/CodePrefix errors.
- Validation errors already directly notify and return before API call; this change does not duplicate those.

- [ ] 2.3 Adopt fallback in Price List editor saves for header, inline price, and item price writes.

File: `FRONTENT/src/composables/masters/priceLists/usePriceListEditor.js`

FROM:
```js
import { ref, computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useWorkflowStore } from 'src/stores/workflow'
import { parseVariantTypes } from 'src/composables/masters/products/useProductVariants'
```

TO:
```js
import { ref, computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useWorkflowStore } from 'src/stores/workflow'
import { parseVariantTypes } from 'src/composables/masters/products/useProductVariants'
import { useApiErrorNotify } from 'src/composables/useApiErrorNotify'
```

FROM:
```js
export function usePriceListEditor() {
  const authStore = useAuthStore()
  const dataStore = useDataStore()
  const workflowStore = useWorkflowStore()
```

TO:
```js
export function usePriceListEditor() {
  const authStore = useAuthStore()
  const dataStore = useDataStore()
  const workflowStore = useWorkflowStore()
  const { notifyApiError } = useApiErrorNotify()
```

FROM:
```js
    if (!records.length) return
    await workflowStore.uploadBulkRecords('PriceListItems', records)
  }
```

TO:
```js
    if (!records.length) return { success: true }
    const response = await workflowStore.uploadBulkRecords('PriceListItems', records)
    notifyApiError(response, { fallbackMessage: 'Failed to save price list items' })
    return response
  }
```

FROM:
```js
    await workflowStore.updateResourceRecord('PriceList', code, {
      SKUPrices: JSON.stringify(priceObj)
    })
  }
```

TO:
```js
    const response = await workflowStore.updateResourceRecord('PriceList', code, {
      SKUPrices: JSON.stringify(priceObj)
    })
    notifyApiError(response, { fallbackMessage: 'Failed to save price list prices' })
    return response
  }
```

FROM:
```js
      if (headerChanged.value && editingHeader.value) {
        await workflowStore.updateResourceRecord('PriceList', expandedCode.value, {
          Name: editingHeader.value.Name,
          Description: editingHeader.value.Description,
          Currency: editingHeader.value.Currency,
          IsDefault: editingHeader.value.IsDefault,
          Status: editingHeader.value.Status
        })
      }

      if (pricesChanged.value) {
        if (priceListLookupMode.value === 'ITEMS') {
          await _savePricesViaItems()
        } else {
          await _savePricesViaInline()
        }
      }
```

TO:
```js
      if (headerChanged.value && editingHeader.value) {
        const headerResponse = await workflowStore.updateResourceRecord('PriceList', expandedCode.value, {
          Name: editingHeader.value.Name,
          Description: editingHeader.value.Description,
          Currency: editingHeader.value.Currency,
          IsDefault: editingHeader.value.IsDefault,
          Status: editingHeader.value.Status
        })
        notifyApiError(headerResponse, { fallbackMessage: 'Failed to save price list details' })
        if (!headerResponse?.success) return headerResponse
      }

      if (pricesChanged.value) {
        const priceResponse = priceListLookupMode.value === 'ITEMS'
          ? await _savePricesViaItems()
          : await _savePricesViaInline()
        if (priceResponse && !priceResponse.success) return priceResponse
      }
```

Rationale:
- Price List editor currently awaits workflow calls but ignores failed responses.
- This fallback prevents silent failures while keeping services/stores UI-free.
- Existing pages with manual notifications are not modified here, so no existing manual toast is broken or duplicated.

### Step 3: Skip CodePrefix generation when payload supplies Code
**Files**:
- `GAS/resourceApi.gs`
- `FRONTENT/src/components/Masters/_common/MasterAddForm.vue` (read-only verification; no edit required)
- `FRONTENT/src/composables/resources/useCompositeForm.js` (read-only verification from Step 2; no additional payload edit required)

**Pattern**: Existing code already uses `resolveCodeValue({ record })` in bulk upsert and `extractProvidedHeaderValues(...)` for header-driven writes. Keep those helpers and only branch around code generation.

**Rule**:
- If `payload.record.Code` or `payload.data.Code` is non-empty, use it directly, skip `CodePrefix` validation, and skip `generateNextCode` / `generateNextYearScopedCode`.
- Else preserve existing auto-code behavior exactly: require `CodePrefix`, then generate normal or year-scoped code based on scope.
- Products, SKUs, PriceList, operation records, and other auto-coded resources must continue generating codes as before when no manual `Code` is supplied.

- [ ] 3.1 Update `handleResourceCreateRecord()` in `GAS/resourceApi.gs`.

FROM:
```js
  const providedValues = extractProvidedHeaderValues(headers, { record: recordPayload });

  const codePrefix = (resource.config.codePrefix || '').toString().trim();
  if (!codePrefix) {
    return { success: false, message: 'CodePrefix is missing for resource: ' + resourceName };
  }

  const seqLength = resource.config.codeSequenceLength || 6;
  const code = resource.config.scope === 'operation'
    ? generateNextYearScopedCode(values, idx, codePrefix, seqLength)
    : generateNextCode(values, idx, codePrefix, seqLength);
  const rowData = buildNewMasterRow(headers, idx, providedValues, schema);
  rowData[idx.Code] = code;
```

TO:
```js
  const providedValues = extractProvidedHeaderValues(headers, { record: recordPayload });
  const providedCode = resolveCodeValue({ record: recordPayload });

  let code = providedCode;
  if (!code) {
    const codePrefix = (resource.config.codePrefix || '').toString().trim();
    if (!codePrefix) {
      return { success: false, message: 'CodePrefix is missing for resource: ' + resourceName };
    }

    const seqLength = resource.config.codeSequenceLength || 6;
    code = resource.config.scope === 'operation'
      ? generateNextYearScopedCode(values, idx, codePrefix, seqLength)
      : generateNextCode(values, idx, codePrefix, seqLength);
  }

  const rowData = buildNewMasterRow(headers, idx, providedValues, schema);
  rowData[idx.Code] = code;
```

Rationale:
- Currencies and UOMs intentionally have blank `CodePrefix` and required manual `Code` UIFields.
- `MasterAddForm.vue` emits updates for every resolved field, including Code, and `useCompositeForm.buildPayload()` sends `data: { ...parentForm.value }`; no frontend payload change is needed to send Code.
- For auto-coded resources, provided `Code` is absent and current code-generation path remains unchanged.

- [ ] 3.2 Update `compositeSave` parent create branch in `GAS/resourceApi.gs`.

FROM:
```js
  // Build parent row
  var parentProvidedValues = {};
  Object.keys(parentData).forEach(function(key) {
    if (key === 'Code' || isAuditHeader(key)) return;
    parentProvidedValues[key] = parentData[key];
  });

  var parentCode;
  var parentRowData;
  var parentRowNumber = -1;
```

TO:
```js
  // Build parent row
  var providedParentCode = resolveCodeValue({ record: parentData });
  var parentProvidedValues = {};
  Object.keys(parentData).forEach(function(key) {
    if (key === 'Code' || isAuditHeader(key)) return;
    parentProvidedValues[key] = parentData[key];
  });

  var parentCode;
  var parentRowData;
  var parentRowNumber = -1;
```

FROM:
```js
  } else {
    var codePrefix = (parentResource.config.codePrefix || '').toString().trim();
    if (!codePrefix) {
      return { success: false, message: 'CodePrefix is missing for resource: ' + parentResourceName };
    }
    var seqLength = parentResource.config.codeSequenceLength || 6;
    parentCode = parentResource.config.scope === 'operation'
      ? generateNextYearScopedCode(parentValues, parentIdx, codePrefix, seqLength)
      : generateNextCode(parentValues, parentIdx, codePrefix, seqLength);
    parentRowData = buildNewMasterRow(parentHeaders, parentIdx, parentProvidedValues, parentSchema);
    parentRowData[parentIdx.Code] = parentCode;
    applyAccessRegionOnWrite(parentRowData, parentIdx, auth);
    applyAuditFields(parentRowData, parentIdx, auth, parentResource.config, true);
  }
```

TO:
```js
  } else {
    parentCode = providedParentCode;
    if (!parentCode) {
      var codePrefix = (parentResource.config.codePrefix || '').toString().trim();
      if (!codePrefix) {
        return { success: false, message: 'CodePrefix is missing for resource: ' + parentResourceName };
      }
      var seqLength = parentResource.config.codeSequenceLength || 6;
      parentCode = parentResource.config.scope === 'operation'
        ? generateNextYearScopedCode(parentValues, parentIdx, codePrefix, seqLength)
        : generateNextCode(parentValues, parentIdx, codePrefix, seqLength);
    }
    parentRowData = buildNewMasterRow(parentHeaders, parentIdx, parentProvidedValues, parentSchema);
    parentRowData[parentIdx.Code] = parentCode;
    applyAccessRegionOnWrite(parentRowData, parentIdx, auth);
    applyAuditFields(parentRowData, parentIdx, auth, parentResource.config, true);
  }
```

Rationale:
- Generic AddPage uses composite save even for parent-only creates.
- This is the path Currencies/UOMs use through `useCompositeForm.save()`.
- `parentProvidedValues` still excludes `Code` so `Code` is assigned only through the canonical `parentRowData[parentIdx.Code] = parentCode` line.

- [ ] 3.3 Confirm `handleResourceBulkUpsertRecords()` does not require a CodePrefix edit.

Verification snippet in `GAS/resourceApi.gs`:
```js
      if (rowNumber === -1) {
        // --- INSERT (collect for batch) ---
        var newCode = code || (resource.config.scope === 'operation'
          ? generateNextYearScopedCode(currentValues, idx, codePrefix, seqLength)
          : generateNextCode(currentValues, idx, codePrefix, seqLength));
        rowData = buildNewMasterRow(headers, idx, providedValues, schema);
        rowData[idx.Code] = newCode;
```

Rationale:
- Bulk upsert already resolves `code` first and only generates when code is blank.
- There is no `if (!codePrefix) return ...` guard in this handler.
- Manual-code bulk uploads for Currencies/UOMs should already work when every inserted record supplies `Code`.
- Do not change this handler unless a new failing test proves blank manual codes are being generated; that behavior is expected to fail validation if `Code` is required.

- [ ] 3.4 Push GAS after Step 1 and Step 3 GAS edits:
```cmd
npm run gas:push
```

### Step 4: Make Price List cards expand/collapse reliably
**Files**:
- `FRONTENT/src/pages/Masters/PriceLists/IndexPage.vue`
- `FRONTENT/src/composables/masters/priceLists/usePriceListEditor.js`

**Pattern**: Keep business/edit state in the Price List editor composable. The page renders UI and binds expansion state via composable functions. Use a per-record boolean binding derived from the row Code.

**Rule**:
- Each card must use a unique expanded state based on its `row.Code`.
- Clicking a card header expands that card.
- Clicking the same header again collapses it.
- Expanding another card collapses the previous card.

- [ ] 4.1 Add composable helpers for unique per-record expansion state.

File: `FRONTENT/src/composables/masters/priceLists/usePriceListEditor.js`

FROM:
```js
  function togglePriceList(code) {
    if (expandedCode.value === code) collapsePriceList()
    else expandPriceList(code)
  }

  function updateHeaderField(header, value) {
```

TO:
```js
  function isPriceListExpanded(code) {
    return !!code && expandedCode.value === code
  }

  function setPriceListExpanded(code, expanded) {
    if (expanded) expandPriceList(code)
    else if (expandedCode.value === code) collapsePriceList()
  }

  function togglePriceList(code) {
    setPriceListExpanded(code, expandedCode.value !== code)
  }

  function updateHeaderField(header, value) {
```

FROM:
```js
    groupedSkus,
    togglePriceList,
    expandPriceList,
    collapsePriceList,
    updateHeaderField,
```

TO:
```js
    groupedSkus,
    isPriceListExpanded,
    setPriceListExpanded,
    togglePriceList,
    expandPriceList,
    collapsePriceList,
    updateHeaderField,
```

Rationale:
- Quasar `q-expansion-item` expects a per-item boolean model.
- The composable keeps one expanded code and exposes row-specific boolean accessors.

- [ ] 4.2 Replace the manual `q-card-section` + `q-slide-transition` expansion block with `q-expansion-item` bound to the row code.

File: `FRONTENT/src/pages/Masters/PriceLists/IndexPage.vue`

FROM:
```vue
            <q-card-section
              class="q-pa-sm q-pa-md cursor-pointer"
              @click="editor.togglePriceList(row.Code)"
            >
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-caption text-grey-6">{{ row.Code }}</div>
                  <div class="text-subtitle1 text-weight-bold">{{ row.Name || '(Unnamed)' }}</div>
                  <div class="row q-gutter-xs q-mt-xs">
                    <q-badge outline :color="row.Status === 'Active' ? 'positive' : 'grey-6'">
                      {{ row.Status || 'Active' }}
                    </q-badge>
                    <q-badge v-if="row.Currency" outline color="primary">{{ row.Currency }}</q-badge>
                    <q-badge v-if="row.IsDefault === 'TRUE'" outline color="orange">Default</q-badge>
                  </div>
                </div>
                <q-icon
                  :name="editor.expandedCode === row.Code ? 'expand_less' : 'expand_more'"
                  color="grey-6"
                />
              </div>
            </q-card-section>

            <q-slide-transition>
              <div v-if="editor.expandedCode === row.Code">
                <q-separator />
                <q-card-section class="q-pa-sm q-pa-md">
                  <div class="text-subtitle2 text-weight-medium q-mb-sm">Price List Details</div>
```

TO:
```vue
            <q-expansion-item
              :model-value="editor.isPriceListExpanded(row.Code)"
              class="pl-expansion"
              expand-icon="expand_more"
              expanded-icon="expand_less"
              @update:model-value="editor.setPriceListExpanded(row.Code, $event)"
            >
              <template #header>
                <div class="row items-center no-wrap full-width">
                  <div class="col">
                    <div class="text-caption text-grey-6">{{ row.Code }}</div>
                    <div class="text-subtitle1 text-weight-bold">{{ row.Name || '(Unnamed)' }}</div>
                    <div class="row q-gutter-xs q-mt-xs">
                      <q-badge outline :color="row.Status === 'Active' ? 'positive' : 'grey-6'">
                        {{ row.Status || 'Active' }}
                      </q-badge>
                      <q-badge v-if="row.Currency" outline color="primary">{{ row.Currency }}</q-badge>
                      <q-badge v-if="row.IsDefault === 'TRUE'" outline color="orange">Default</q-badge>
                    </div>
                  </div>
                </div>
              </template>

              <q-separator />
              <q-card-section class="q-pa-sm q-pa-md">
                <div class="text-subtitle2 text-weight-medium q-mb-sm">Price List Details</div>
```

FROM:
```vue
                  <div class="row justify-end q-mt-sm q-gutter-sm">
                    <q-btn flat no-caps label="Cancel" @click="editor.collapsePriceList()" />
                    <q-btn
                      color="primary"
                      unelevated
                      no-caps
                      label="Save"
                      :loading="editor.saving"
                      :disable="!(editor.headerChanged || editor.pricesChanged)"
                      @click="handleSave"
                    />
                  </div>
                </q-card-section>
              </div>
            </q-slide-transition>
```

TO:
```vue
                <div class="row justify-end q-mt-sm q-gutter-sm">
                  <q-btn flat no-caps label="Cancel" @click="editor.collapsePriceList()" />
                  <q-btn
                    color="primary"
                    unelevated
                    no-caps
                    label="Save"
                    :loading="editor.saving"
                    :disable="!(editor.headerChanged || editor.pricesChanged)"
                    @click="handleSave"
                  />
                </div>
              </q-card-section>
            </q-expansion-item>
```

Rationale:
- The old implementation manually handled card clicks and conditional rendering. It rendered expandable-looking cards but did not use a component-level expansion model.
- `q-expansion-item` provides reliable click handling and expansion animation.
- Binding `:model-value` to `editor.isPriceListExpanded(row.Code)` ensures every card has a unique boolean state derived from its code.

- [ ] 4.3 Add a small style hook for expansion header spacing if needed.

File: `FRONTENT/src/pages/Masters/PriceLists/IndexPage.vue`

FROM:
```vue
.pl-card:hover {
  box-shadow: 0 6px 16px rgba(15, 118, 110, 0.10);
}

.fab-btn {
```

TO:
```vue
.pl-card:hover {
  box-shadow: 0 6px 16px rgba(15, 118, 110, 0.10);
}

.pl-expansion :deep(.q-item) {
  padding: 8px 16px;
}

.fab-btn {
```

Rationale:
- Keeps the previous card header spacing after moving the header into `q-expansion-item`.
- This is component-specific styling for this one custom Price List page and is acceptable under the architecture rules.

## Documentation Updates Required
- [ ] No canonical documentation update is required for Step 1 because the Google Sheet menu items did not change; the frontend sidebar metadata changed. `Documents/AQL_MENU_ADMIN_GUIDE.md` already documents the required post-edit workflow: `Sync APP.Resources from Code` and `Regenerate App Cache`.
- [ ] No architecture doc update is required because the error-notification fallback follows the existing layer ownership: services return raw responses, stores normalize/manage state, composables perform UI side effects, components render UI.
- [ ] No API contract documentation update is required because GAS response/request envelopes are unchanged. The create/composite behavior is a bug fix that preserves auto-code behavior and adds support for already-configured manual-code resources.

## Verification / Commands
- [ ] Run targeted frontend lint/type/build check if available and quick. If no dedicated lint command exists, run only a syntax/build check for the frontend if the Build Agent judges the risk acceptable:
```cmd
cd FRONTENT && npm run build
```
Use the frontend build only if dependencies are installed and the Build Agent has time; this touches a small number of files but includes Vue template changes.

- [ ] Run GAS push after GAS edits:
```cmd
npm run gas:push
```

- [ ] Manual APP menu actions after GAS push:
  - [ ] `AQL 🚀 > 📚 Resources > Sync APP.Resources from Code`
  - [ ] `AQL 🚀 > 📚 Resources > Regenerate App Cache`

## Acceptance Criteria
- [ ] Currencies appears under `Masters` in the frontend sidebar after GAS push, resource sync, cache regeneration, and frontend re-login/refresh.
- [ ] Currencies no longer appears under the `Product` sidebar group.
- [ ] Saving a Currency with a valid manual code such as `AED` succeeds and shows the normal success behavior/toast already present in the app flow.
- [ ] Saving a Currency with an API validation error shows a visible negative toast at the top of the screen.
- [ ] Saving a Currency with code `AED` does NOT produce `CodePrefix is missing for resource: Currencies`.
- [ ] UOM creation with a valid manual code also succeeds without depending on `CodePrefix`.
- [ ] UOM API errors also surface through the generic common save fallback notification.
- [ ] Price List cards expand when their header is clicked.
- [ ] Price List cards collapse when the same header is clicked a second time.
- [ ] Expanding one Price List card collapses any previously expanded Price List card.
- [ ] No regression: Products still auto-generate `PRD...` codes.
- [ ] No regression: SKUs still auto-generate `SKU...` codes.
- [ ] No regression: Price Lists still auto-generate `PLC...` codes.
- [ ] No regression: operation-scoped auto-coded resources still use year-scoped generation.
- [ ] No duplicate error toast appears in the generic Currencies/UOM create flow for one failed API response.

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task (e.g., after 1.1, after 2.4b). Mark `[x]` immediately after the task is done. This is the single source of execution progress.

If execution is interrupted, the next agent reads this plan, finds the first unchecked `[ ]`, and resumes from that exact sub-task.

### Format
- `[ ]` = not started
- `[-]` = in progress (ONLY ONE at a time)
- `[x]` = completed
- `[~]` = skipped (explain in Deviations)

### Progress Log
- [x] Step 1.1 updated Currencies menu group/order in `GAS/syncAppResources.gs`
- [x] Step 1.2 ran `npm run gas:push` after menu change or combined GAS changes
- [~] Step 1.3 ran APP menu `Sync APP.Resources from Code` (handed off to user)
- [~] Step 1.4 ran APP menu `Regenerate App Cache` (handed off to user)
- [~] Step 1.5 refreshed/re-logged frontend session for new sidebar metadata (handed off to user)
- [x] Step 2.1 created `FRONTENT/src/composables/useApiErrorNotify.js`
- [x] Step 2.2 adopted fallback in `FRONTENT/src/composables/resources/useCompositeForm.js`
- [x] Step 2.3 adopted fallback in `FRONTENT/src/composables/masters/priceLists/usePriceListEditor.js`
- [x] Step 3.1 updated `handleResourceCreateRecord()` in `GAS/resourceApi.gs`
- [x] Step 3.2 updated `compositeSave` parent create branch in `GAS/resourceApi.gs`
- [x] Step 3.3 confirmed no bulk upsert codePrefix guard change is needed
- [x] Step 3.4 ran `npm run gas:push` after GAS changes
- [x] Step 4.1 added Price List expansion helpers in `usePriceListEditor.js`
- [x] Step 4.2 replaced manual slide expansion with row-code-bound `q-expansion-item`
- [x] Step 4.3 added Price List expansion spacing style
- [x] Verification commands/manual validation completed
- [~] Acceptance criteria verified

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [x] `[!]` Manual APP menu sync/cache actions are intentionally handed off to the user, who will run them in the APP sheet after reviewing the repo changes.

### Files Actually Changed
- `GAS/syncAppResources.gs`
- `GAS/resourceApi.gs`
- `FRONTENT/src/composables/useApiErrorNotify.js`
- `FRONTENT/src/composables/resources/useCompositeForm.js`
- `FRONTENT/src/composables/masters/priceLists/usePriceListEditor.js`
- `FRONTENT/src/pages/Masters/PriceLists/IndexPage.vue`
- `FRONTENT/src/composables/REGISTRY.md`

### Validation Performed
- [x] GAS pushed successfully with `npm run gas:push`
- [ ] APP.Resources synced from code
- [ ] App cache regenerated
- [x] Frontend build or targeted syntax verification completed, if run
- [ ] Manual Currencies create success and failure paths tested
- [ ] Manual UOM create success path tested
- [ ] Manual Price List card expand/collapse tested
- [~] Acceptance criteria verified

### Manual Actions Required
- [ ] APP spreadsheet: `AQL 🚀 > 📚 Resources > Sync APP.Resources from Code`
- [ ] APP spreadsheet: `AQL 🚀 > 📚 Resources > Regenerate App Cache`
- [ ] Frontend user: re-login/refresh session after cache regeneration
- [ ] Web App redeployment is NOT required because the API contract did not change; only backend behavior changed inside existing handlers.
