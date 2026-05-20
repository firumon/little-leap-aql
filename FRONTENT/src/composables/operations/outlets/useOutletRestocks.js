import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { OUTLET_OPERATION_RESOURCES, RESTOCK_PROGRESS_ORDER, active, progressMeta, sortTime, text, todayISO } from './outletOperationsMeta.js'
import { allocatedRows, approvalRequestedQty, computeRestockProgressFromItems, expandOrsiAllocationRows, recommendOrsiAllocation, restockEditableProgress, storageName, sumBy, toNumber, validateRestockAllocationRows, validateRestockApproval, validateRestockDraft, warehouseAvailableQty, warehouseDisplayName, warehouseStorageCandidatesForSku } from './outletStockLogic.js'
import { buildPendingRestockAllocationBatchRequests, buildRestockAllocationBatchRequests, buildRestockCancelItemsBatchRequests, buildRestockCompositePayload, buildRestockRejectBatchRequests, buildRestockSendBackRequest } from './outletRestockPayload.js'
import { compositeSaveRequest, failureMessage, resourceGetRequest, responseFailed } from './outletOperationsBatch.js'

export function resolveRestockViewMode(progress) {
  if (['DRAFT', 'REVISION_REQUIRED'].includes(text(progress))) return 'editable'
  if (text(progress) === 'PENDING_APPROVAL') return 'review'
  return 'readonly'
}

export function useOutletRestocks() {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()
  const restocks = useResourceData(ref('OutletRestocks'))
  const restockItems = useResourceData(ref('OutletRestockItems'))
  const outlets = useResourceData(ref('Outlets'))
  const skus = useResourceData(ref('SKUs'))
  const products = useResourceData(ref('Products'))
  const warehouseStorages = useResourceData(ref('WarehouseStorages'))
  const warehouses = useResourceData(ref('Warehouses'))
  const loading = ref(false)
  const saving = ref(false)
  const searchTerm = ref('')
  const form = ref({ Date: todayISO(), RequestedUser: currentUserName(), Progress: 'DRAFT', Status: 'Active' })
  const rows = ref([{ SKU: '', Quantity: 1, Progress: 'PENDING', Status: 'Active' }])

  const items = computed(() => restocks.items.value.filter(active).filter(row => !searchTerm.value || JSON.stringify(row).toLowerCase().includes(searchTerm.value.toLowerCase())))
  const groups = computed(() => RESTOCK_PROGRESS_ORDER.map(key => ({ key, meta: progressMeta(key), items: items.value.filter(row => (RESTOCK_PROGRESS_ORDER.includes(row.Progress) ? row.Progress : 'OTHER') === key).sort((a, b) => sortTime(b) - sortTime(a)) })).filter(group => group.items.length))
  const outletOptions = computed(() => outlets.items.value.filter(active).map(row => ({ label: `${row.Code} · ${row.Name}`, value: row.Code })))
  const skuOptions = computed(() => skus.items.value.filter(active).map((sku) => {
    const product = products.items.value.find(row => row.Code === sku.ProductCode)
    const variants = [sku.Variant1, sku.Variant2, sku.Variant3, sku.Variant4, sku.Variant5].map(text).filter(Boolean).join(' / ')
    return { label: `${sku.Code} · ${product?.Name || sku.ProductCode || 'Product'}${variants ? ` · ${variants}` : ''}`, value: sku.Code }
  }))

  const approvalAllocationGroups = computed(() => buildApprovalAllocationGroups())
  const pendingAllocationGroups = computed(() => buildPendingAllocationGroups())
  const hasAllocatedApprovalRows = computed(() => allocatedRows(rows.value).length > 0)
  const pendingAllocationDraftRows = computed(() => rows.value.filter(row => active(row) && text(row.Progress) === 'ALLOCATED' && !text(row.Code)))
  const hasNewAllocatedRows = computed(() => pendingAllocationDraftRows.value.length > 0)

  const restockResource = computed(() => (Array.isArray(authStore.resources) ? authStore.resources : []).find(r => r.name === 'OutletRestocks') || {})
  const resourcePerms = computed(() => restockResource.value.permissions || {})
  const canCreate = computed(() => !!resourcePerms.value.canWrite)
  const canApprove = computed(() => !!resourcePerms.value.canUpdate)

  function currentUserName() {
    const user = authStore.user || {}
    return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code)
  }
  function currentTimestampLabel(date = new Date()) { return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) }
  function appendWorkflowComment(existingValue = '', comment = '', actorName = currentUserName(), date = new Date()) {
    const trimmedComment = text(comment)
    if (!trimmedComment) return text(existingValue)
    const nextEntry = `${actorName || 'Unknown User'} wrote at ${currentTimestampLabel(date)}:\n${trimmedComment}`
    const base = text(existingValue)
    return base ? `${base}\n\n${nextEntry}` : nextEntry
  }
  function formatWorkflowCommentHtml(value = '') { return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br>') }
  function submitCommentFields(restock = {}, comment = '') { return text(restock.Progress) === 'REVISION_REQUIRED' ? { ProgressRevisionRequiredComment: appendWorkflowComment(restock.ProgressRevisionRequiredComment, comment) } : { ProgressSubmittedComment: text(comment) ? appendWorkflowComment(restock.ProgressSubmittedComment, comment) : text(restock.ProgressSubmittedComment) } }
  function submissionSaveForm(restock = {}, comment = '') { return { ...form.value, Progress: 'PENDING_APPROVAL', ...submitCommentFields(restock, comment) } }

  function skuDisplay(skuCode = '') {
    const sku = skus.items.value.find(row => text(row.Code) === text(skuCode)) || {}
    const product = products.items.value.find(row => text(row.Code) === text(sku.ProductCode)) || {}
    const variants = [sku.Variant1, sku.Variant2, sku.Variant3, sku.Variant4, sku.Variant5].map(text).filter(Boolean)
    return {
      primary: `${text(product.Name || sku.ProductCode || skuCode || 'Item')}${variants.length ? ` - ${variants.join(' / ')}` : ''}`,
      secondary: text(skuCode) ? `SKU ${text(skuCode)}` : ''
    }
  }
  function approvalSourceKey(row = {}, index = 0) {
    if (text(row._approvalSourceKey)) return text(row._approvalSourceKey)
    const sku = text(row.SKU)
    return sku ? `${text(row.OutletRestockCode || form.value.Code || 'restock')}|${sku}` : `row:${index}`
  }
  function pendingAllocationSourceKey(row = {}, index = 0) {
    if (text(row._approvalSourceKey)) return text(row._approvalSourceKey)
    const code = text(row.Code)
    const sku = text(row.SKU)
    if (code) return `pending:${code}`
    return sku ? `pending:${text(row.OutletRestockCode || form.value.Code || 'restock')}|${sku}|${index}` : `pending-row:${index}`
  }
  function restockItemIdentity(row = {}) {
    return text(row.Code) || text(row._pendingSourceCode) || text(row._approvalSourceKey)
  }
  function rowBelongsToKey(row = {}, index = 0, rowKey = '', keyResolver = approvalSourceKey) {
    if (keyResolver(row, index) === rowKey) return true
    return text(row._approvalSourceKey) === text(rowKey)
  }
  function buildApprovalRowView(entries = [], rowKey = '') {
    const source = entries[0]?.row || {}
    const requestedQty = approvalRequestedQty(entries.map(entry => entry.row))
    const display = skuDisplay(source.SKU)
    const recommendation = recommendOrsiAllocation({ ...source, Quantity: requestedQty }, warehouseStorages.items.value)
    const allocatedEntries = entries.filter(entry => text(entry.row.Progress) === 'ALLOCATED')
    const pendingEntries = entries.filter(entry => text(entry.row.Progress) !== 'ALLOCATED')
    const currentLines = allocatedEntries.map((entry, lineIndex) => ({
      lineKey: entry.row.Code || `${rowKey}:allocated:${lineIndex}`,
      lineIndex,
      rowIndex: entry.index,
      warehouseCode: text(entry.row.WarehouseCode),
      warehouseName: warehouseDisplayName(warehouses.items.value, entry.row.WarehouseCode),
      storageName: text(entry.row.StorageName),
      quantity: toNumber(entry.row.Quantity),
      availableQty: warehouseAvailableQty(warehouseStorages.items.value, entry.row)
    }))
    const candidates = warehouseStorageCandidatesForSku(warehouseStorages.items.value, source.SKU).map(c => {
      const match = currentLines.find(l => l.warehouseCode === c.warehouseCode && l.storageName === c.storageName)
      return {
        id: c.id,
        warehouseCode: c.warehouseCode,
        warehouseName: warehouseDisplayName(warehouses.items.value, c.warehouseCode),
        storageName: c.storageName,
        available: Math.min(c.available, requestedQty),
        quantity: match ? match.quantity : 0
      }
    })
    const allocatedQty = sumBy(candidates, 'quantity')
    const isAllocated = allocatedQty > 0
    const pendingQty = isAllocated ? Math.max(requestedQty - allocatedQty, 0) : recommendation.remainingQty
    const allocationSummaryRows = candidates
      .filter(candidate => toNumber(candidate.quantity) > 0)
      .map(candidate => ({
        skuLabel: display.primary,
        skuCode: text(source.SKU),
        requestedQty,
        allocatedQty: toNumber(candidate.quantity),
        availableQty: toNumber(candidate.available),
        warehouseCode: candidate.warehouseCode,
        warehouseName: candidate.warehouseName,
        storageName: candidate.storageName
      }))
    return {
      rowKey,
      itemLabel: display.primary,
      requestedQty,
      availableQty: recommendation.availableQty,
      allocatedQty,
      remainingQty: Math.max(requestedQty - allocatedQty, 0),
      pendingQty,
      availabilityGroup: recommendation.availabilityGroup,
      isAllocated,
      canApplyRecommendation: recommendation.availabilityGroup !== 'none' && !isAllocated,
      storageCandidates: candidates,
      allocationSummaryRows,
      pendingLines: pendingQty > 0 ? [{ quantity: pendingQty }] : []
    }
  }
  function buildAllocationGroups(sourceRows = rows.value, keyResolver = approvalSourceKey) {
    const grouped = new Map()
    sourceRows.filter(active).forEach((row, index) => {
      const rowKey = keyResolver(row, index)
      if (!grouped.has(rowKey)) grouped.set(rowKey, [])
      grouped.get(rowKey).push({ row, index })
    })
    const buckets = [
      { key: 'full', title: 'Fully Available', rows: [] },
      { key: 'partial', title: 'Partially Available', rows: [] },
      { key: 'none', title: 'Not Available', rows: [] }
    ]
    grouped.forEach((entries, rowKey) => {
      const view = buildApprovalRowView(entries, rowKey)
      const bucket = buckets.find(group => group.key === view.availabilityGroup) || buckets[2]
      bucket.rows.push(view)
    })
    return buckets.map(group => ({
      ...group,
      count: group.rows.length,
      requestedQty: sumBy(group.rows, 'requestedQty'),
      availableQty: sumBy(group.rows, 'availableQty')
    }))
  }
  function buildApprovalAllocationGroups() { return buildAllocationGroups(rows.value, approvalSourceKey) }
  function buildPendingAllocationGroups() {
    return buildAllocationGroups(rows.value.filter((row, index) => {
      if (!active(row)) return false
      if (text(row.Progress) === 'PENDING') return true
      if (text(row.Progress) !== 'ALLOCATED') return false
      return !!text(row._approvalSourceKey)
    }), pendingAllocationSourceKey)
  }
  function findEntries(rowKey = '', keyResolver = approvalSourceKey) {
    return rows.value
      .map((row, index) => ({ row, index, rowKey: keyResolver(row, index) }))
      .filter(entry => rowBelongsToKey(entry.row, entry.index, rowKey, keyResolver) && active(entry.row))
  }
  function findApprovalEntries(rowKey = '') { return findEntries(rowKey, approvalSourceKey) }
  function findPendingAllocationEntries(rowKey = '') { return findEntries(rowKey, pendingAllocationSourceKey) }
  function replaceApprovalEntries(entries = [], nextRows = []) {
    if (!entries.length) return false
    const insertAt = Math.min(...entries.map(entry => entry.index))
    entries.map(entry => entry.index).sort((a, b) => b - a).forEach(index => rows.value.splice(index, 1))
    rows.value.splice(insertAt, 0, ...nextRows)
    return true
  }
  function rebalancePendingRemainder(rowKey = '', keyResolver = approvalSourceKey) {
    const entries = findEntries(rowKey, keyResolver)
    if (!entries.length) return false
    const requestedQty = approvalRequestedQty(entries.map(entry => entry.row))
    const allocatedQty = sumBy(entries.filter(entry => text(entry.row.Progress) === 'ALLOCATED').map(entry => entry.row), 'Quantity')
    const pendingEntries = entries.filter(entry => text(entry.row.Progress) !== 'ALLOCATED')
    const remainderQty = Math.max(requestedQty - allocatedQty, 0)
    if (pendingEntries.length) {
      pendingEntries.slice(1).map(entry => entry.index).sort((a, b) => b - a).forEach(index => rows.value.splice(index, 1))
      const first = findEntries(rowKey, keyResolver).find(entry => text(entry.row.Progress) !== 'ALLOCATED')
      if (!first) return true
      if (remainderQty > 0) rows.value[first.index] = { ...first.row, Quantity: remainderQty, Progress: 'PENDING', _approvalRequestedQty: requestedQty }
      else rows.value.splice(first.index, 1)
      return true
    }
    if (remainderQty <= 0) return true
    const source = entries[0].row
    const insertAt = Math.max(...entries.map(entry => entry.index)) + 1
    rows.value.splice(insertAt, 0, {
      SKU: source.SKU,
      OutletRestockCode: text(source.OutletRestockCode || form.value.Code),
      Quantity: remainderQty,
      Progress: 'PENDING',
      Status: 'Active',
      AccessRegion: text(source.AccessRegion || form.value.AccessRegion),
      _approvalSourceKey: rowKey,
      _approvalRequestedQty: requestedQty
    })
    return true
  }

  async function reload(forceSync = false) { loading.value = true; try { await resourceIoStore.fetchResources(OUTLET_OPERATION_RESOURCES, { forceSync }) } finally { loading.value = false } }
  async function reloadIndex(forceSync = false) { loading.value = true; try { await resourceIoStore.fetchResources(['OutletRestocks', 'OutletRestockItems', 'Outlets'], { forceSync }) } finally { loading.value = false } }
  async function reloadAdd(forceSync = false) { loading.value = true; try { await resourceIoStore.fetchResources(['Outlets', 'SKUs', 'Products'], { forceSync }) } finally { loading.value = false } }
  async function reloadView(forceSync = false) { loading.value = true; try { await resourceIoStore.fetchResources(['OutletRestocks', 'OutletRestockItems', 'WarehouseStorages', 'Outlets', 'SKUs', 'Products'], { forceSync }) } finally { loading.value = false } }

  function loadRestockRows(code = form.value.Code) {
    const selectedCodes = new Set(rows.value.filter(row => row._cancelSelected).map(row => text(row.Code)).filter(Boolean))
    const cancelledCodes = new Set(rows.value.filter(row => text(row.Progress) === 'CANCELLED' && text(row.Code)).map(row => text(row.Code)))
    rows.value = restockItems.items.value
      .filter(row => text(row.OutletRestockCode) === text(code))
      .filter(active)
      .map(row => ({ ...row, Progress: text(row.Progress) || 'PENDING', _cancelSelected: selectedCodes.has(text(row.Code)) }))
    if (cancelledCodes.size) {
      rows.value = rows.value.map(row =>
        cancelledCodes.has(text(row.Code))
          ? { ...row, Progress: 'CANCELLED', _cancelSelected: false }
          : row)
      const currentCodes = new Set(rows.value.map(row => text(row.Code)).filter(Boolean))
      const missing = restockItems.items.value.filter(row => cancelledCodes.has(text(row.Code)) && !currentCodes.has(text(row.Code)))
      if (missing.length) rows.value = rows.value.concat(missing.map(row => ({ ...row, Progress: 'CANCELLED', _cancelSelected: false })))
    }
  }

  function loadRestock(code) {
    const record = restocks.items.value.find(row => row.Code === code)
    if (record) {
      form.value = { ...record, Date: text(record.Date) || todayISO(), RequestedUser: text(record.RequestedUser) || currentUserName() }
      loadRestockRows(code)
    }
    return record
  }

  watch(restockItems.items, () => { if (text(form.value.Code)) loadRestockRows(form.value.Code) })

  function confirmWarnings(warnings = []) {
    if (!warnings.length) return Promise.resolve(true)
    return new Promise(resolve => {
      $q.dialog({ title: 'Confirm restock warnings', message: warnings.join('<br>'), html: true, cancel: true, persistent: true, ok: { label: 'Continue', color: 'primary' } })
        .onOk(() => resolve(true)).onCancel(() => resolve(false)).onDismiss(() => resolve(false))
    })
  }

  async function saveRestockDraft(submit = false, comment = '') {
    if (form.value.Code && !restockEditableProgress(form.value.Progress)) return notifyWarning(`Restock ${form.value.Code} cannot be edited while progress is ${text(form.value.Progress) || 'blank'}.`)
    if (submit && text(form.value.Progress) === 'REVISION_REQUIRED' && !text(comment)) return notifyWarning('Resubmit comment is required.')
    const validation = validateRestockDraft(form.value, rows.value)
    if (!validation.valid) return notifyWarning(validation.errors[0])
    if (!(await confirmWarnings(validation.warnings))) return false
    saving.value = true
    try {
      const payloadForm = submit ? submissionSaveForm(form.value, comment) : form.value
      const saveResult = await resourceIoStore.runBatchRequests([compositeSaveRequest(buildRestockCompositePayload(payloadForm, rows.value))])
      if (responseFailed(saveResult)) return notifyError(failureMessage(saveResult, submit ? 'Failed to submit restock.' : 'Failed to save restock.'))
      $q.notify({ type: 'positive', message: submit ? 'Restock submitted.' : 'Restock draft saved.', position: 'top' })
      nav.goTo('list')
      return true
    } finally { saving.value = false }
  }

  async function submitRestock(restock = form.value, comment = '') {
    if (!restockEditableProgress(restock.Progress)) return notifyWarning(`Restock ${restock.Code} cannot be submitted while progress is ${text(restock.Progress) || 'blank'}.`)
    if (text(restock.Progress) === 'REVISION_REQUIRED' && !text(comment)) return notifyWarning('Resubmit comment is required.')
    form.value = { ...form.value, ...restock }
    return saveRestockDraft(true, comment)
  }

  async function approveRestock(restock, approvedRows = rows.value, comment = '') {
    const validation = validateRestockApproval(restock, approvedRows, warehouseStorages.items.value)
    if (!validation.valid) return notifyWarning(validation.errors[0])
    saving.value = true
    try {
      const result = await resourceIoStore.runBatchRequests(buildRestockAllocationBatchRequests(restock, approvedRows, currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to approve restock.'))
      $q.notify({ type: 'positive', message: 'Restock approved.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }

  async function allocatePendingRestockItems(restock, allocatedPendingRows = rows.value, comment = '') {
    const rowsToAllocate = allocatedPendingRows.filter(row => text(row.Progress) === 'ALLOCATED' && (!text(row.Code) || text(row._pendingSourceCode)))
    if (!rowsToAllocate.length) return notifyWarning('Select at least one pending allocation.')
    const sourceKeys = Array.from(new Set(rowsToAllocate.map(row => text(row._pendingSourceCode || row._approvalSourceKey || row.Code).replace(/^pending:/, '')).filter(Boolean)))
    const sourceRows = rows.value.filter(row => text(row.Code) && sourceKeys.includes(text(row.Code)) && text(row.Progress) === 'PENDING')
    const rowsToPersist = [...sourceRows, ...rowsToAllocate]
    const validation = validateRestockAllocationRows(rowsToPersist, warehouseStorages.items.value)
    if (!validation.valid) return notifyWarning(validation.errors[0])
    saving.value = true
    try {
      const requests = buildPendingRestockAllocationBatchRequests(restock, rowsToPersist, currentUserName(), comment)
      requests.push(resourceGetRequest(['WarehouseStorages'], {}))
      const result = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to allocate pending items.'))
      $q.notify({ type: 'positive', message: 'Pending items allocated.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }

  async function cancelPendingRestockItems(restock, comment = '') {
    if (!text(comment)) return notifyWarning('Cancel comment is required.')
    const rowsToCancel = rows.value.filter(row => row._cancelSelected && text(row.Progress) === 'PENDING' && text(row.Code))
    if (!rowsToCancel.length) return notifyWarning('Select at least one pending item to cancel.')
    const cancelCodes = new Set(rowsToCancel.map(row => text(row.Code)).filter(Boolean))
    saving.value = true
    try {
      const result = await resourceIoStore.runBatchRequests(buildRestockCancelItemsBatchRequests(restock, rowsToCancel, currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to cancel pending items.'))
      rows.value = rows.value.map(row =>
        cancelCodes.has(text(row.Code)) && text(row.Progress) === 'PENDING' && text(row.Code)
          ? { ...row, Progress: 'CANCELLED', _cancelSelected: false }
          : row)
      $q.notify({ type: 'positive', message: 'Selected pending items cancelled.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }

  async function rejectRestock(restock, comment) {
    if (!text(comment)) return notifyWarning('Comment is required.')
    const childRows = childItems(restock.Code)
    if (childRows.some(row => text(row.Progress) === 'DELIVERED')) return notifyWarning('Delivered restock items cannot be rejected.')
    saving.value = true
    try {
      const result = await resourceIoStore.runBatchRequests(buildRestockRejectBatchRequests(restock, childRows, currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to reject restock.'))
      $q.notify({ type: 'positive', message: 'Restock rejected.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }

  async function sendBackRestock(restock, comment) {
    if (!text(comment)) return notifyWarning('Comment is required.')
    saving.value = true
    try {
      const result = await resourceIoStore.runBatchRequests([buildRestockSendBackRequest(restock, appendWorkflowComment(restock.ProgressRevisionRequiredComment, comment))])
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to send restock back.'))
      $q.notify({ type: 'positive', message: 'Restock sent back.', position: 'top' })
      return true
    } finally { saving.value = false }
  }

  function applyRecommendedAllocation(rowKey, keyResolver = approvalSourceKey) {
    const entries = findEntries(rowKey, keyResolver)
    if (!entries.length) return false
    const source = entries[0].row
    const totalQty = approvalRequestedQty(entries.map(entry => entry.row))
    const recommendation = recommendOrsiAllocation({ ...source, Quantity: totalQty }, warehouseStorages.items.value)
    if (!recommendation.recommendedAllocations.length) return false
    const nextRows = expandOrsiAllocationRows({ ...source, Quantity: totalQty }, recommendation).map(row => ({
      ...row,
      OutletRestockCode: text(row.OutletRestockCode || source.OutletRestockCode || form.value.Code),
      AccessRegion: text(row.AccessRegion || source.AccessRegion || form.value.AccessRegion),
      _pendingSourceCode: text(source.Code || source._pendingSourceCode),
      _approvalSourceKey: rowKey,
      _approvalRequestedQty: totalQty
    }))
    if (keyResolver === pendingAllocationSourceKey) {
      const insertAt = Math.max(...entries.map(entry => entry.index)) + 1
      rows.value.splice(insertAt, 0, ...nextRows)
      return true
    }
    return replaceApprovalEntries(entries, nextRows)
  }
  function ensureAllocationMaterialized(rowKey, keyResolver = approvalSourceKey) {
    const entries = findEntries(rowKey, keyResolver)
    if (entries.some(entry => text(entry.row.Progress) === 'ALLOCATED')) return true
    return applyRecommendedAllocation(rowKey, keyResolver)
  }
  function updateAllocationLine(rowKey, lineIndex = 0, patch = {}) {
    if (!ensureAllocationMaterialized(rowKey)) return false
    const allocated = findApprovalEntries(rowKey).filter(entry => text(entry.row.Progress) === 'ALLOCATED')
    const target = allocated[lineIndex]
    if (!target) return false
    rows.value[target.index] = { ...target.row, ...patch, Quantity: patch.Quantity !== undefined ? toNumber(patch.Quantity) : target.row.Quantity, Progress: 'ALLOCATED' }
    return rebalancePendingRemainder(rowKey)
  }
  function updateAllocationRow(rowKey, patch = {}) { return updateAllocationLine(rowKey, toNumber(patch.lineIndex), patch) }
  function committedPendingRowsForKey(rowKey = '', keyResolver = approvalSourceKey) {
    return findEntries(rowKey, keyResolver).filter(entry => text(entry.row.Code) && text(entry.row.Progress) === 'PENDING')
  }
  function draftAllocationRowsForKey(rowKey = '') {
    return rows.value
      .map((row, index) => ({ row, index }))
      .filter(entry => text(entry.row._approvalSourceKey) === text(rowKey) && text(entry.row.Progress) === 'ALLOCATED' && !text(entry.row.Code) && active(entry.row))
  }
  function sourceRowsForKey(rowKey = '', keyResolver = approvalSourceKey) {
    const entries = findEntries(rowKey, keyResolver)
    const sourceCode = text(rowKey).replace(/^pending:/, '')
    const exactSource = rows.value
      .map((row, index) => ({ row, index }))
      .filter(entry => text(entry.row.Code) === sourceCode && active(entry.row))
    return exactSource.length ? exactSource : entries
  }
  function updateCandidateLine(rowKey = '', warehouseCode = '', storageName = '', quantity = 0, keyResolver = approvalSourceKey) {
    const qty = Math.max(0, toNumber(quantity))
    const sourceEntries = sourceRowsForKey(rowKey, keyResolver)
    if (!sourceEntries.length) return false
    const source = sourceEntries.find(entry => text(entry.row.Code))?.row || sourceEntries[0].row
    const draftEntries = draftAllocationRowsForKey(rowKey)
    const allocated = [...draftEntries, ...findEntries(rowKey, keyResolver).filter(e => text(e.row.Progress) === 'ALLOCATED' && text(e.row.Code))]
    const match = allocated.find(e => text(e.row.WarehouseCode) === text(warehouseCode) && text(e.row.StorageName) === storageName)
    if (match) {
      if (qty > 0) rows.value[match.index] = { ...match.row, Quantity: qty }
      else if (text(match.row.Code)) rows.value[match.index] = { ...match.row, WarehouseCode: '', StorageName: '', Quantity: 1, Progress: 'PENDING' }
      else rows.value.splice(match.index, 1)
    } else if (qty > 0) {
      const requestedQty = approvalRequestedQty(sourceEntries.map(entry => entry.row))
      const insertAt = Math.max(...sourceEntries.map(entry => entry.index)) + 1
      const newRow = { ...source, Code: undefined, WarehouseCode: warehouseCode, StorageName: storageName, Quantity: qty, Progress: 'ALLOCATED', _pendingSourceCode: text(source.Code || source._pendingSourceCode), _approvalSourceKey: rowKey, _approvalRequestedQty: requestedQty }
      rows.value.splice(insertAt, 0, newRow)
    }
    rebalancePendingRemainder(rowKey)
    return true
  }
  function updatePendingCandidateLine(rowKey = '', warehouseCode = '', storageName = '', quantity = 0) {
    if (!updateCandidateLine(rowKey, warehouseCode, storageName, quantity, pendingAllocationSourceKey)) return false
    return true
  }
  function cancelPendingSelection(rowCodes = [], selected = true) {
    const selectedCodes = new Set((Array.isArray(rowCodes) ? rowCodes : [rowCodes]).map(text).filter(Boolean))
    rows.value = rows.value.map(row => selectedCodes.has(text(row.Code)) && text(row.Progress) === 'PENDING'
      ? { ...row, _cancelSelected: selected }
      : row)
  }
  function addAllocationSplit(rowKey) {
    if (!ensureAllocationMaterialized(rowKey)) return false
    const entries = findApprovalEntries(rowKey)
    const pending = entries.find(entry => text(entry.row.Progress) !== 'ALLOCATED' && toNumber(entry.row.Quantity) > 0)
    if (!pending) return false
    const quantity = Math.min(1, toNumber(pending.row.Quantity))
    const requestedQty = approvalRequestedQty(entries.map(entry => entry.row))
    const recommendation = recommendOrsiAllocation({ ...pending.row, Quantity: 1 }, warehouseStorages.items.value)
    const alloc = recommendation.recommendedAllocations[0] || {}
    const nextAllocated = { ...pending.row, Code: undefined, Quantity: quantity, WarehouseCode: text(alloc.WarehouseCode) || '', StorageName: storageName(alloc.StorageName) || '', Progress: 'ALLOCATED', Status: 'Active', _approvalSourceKey: rowKey, _approvalRequestedQty: requestedQty }
    if (toNumber(pending.row.Quantity) > quantity) rows.value[pending.index] = { ...pending.row, Quantity: toNumber(pending.row.Quantity) - quantity, Progress: 'PENDING' }
    else rows.value.splice(pending.index, 1)
    rows.value.splice(pending.index, 0, nextAllocated)
    return true
  }
  function removeAllocationLine(rowKey, lineIndex = 0) {
    const allocated = findApprovalEntries(rowKey).filter(entry => text(entry.row.Progress) === 'ALLOCATED')
    const target = allocated[lineIndex]
    if (!target) return false
    rows.value[target.index] = { ...target.row, WarehouseCode: '', StorageName: '', Progress: 'PENDING' }
    rebalancePendingRemainder(rowKey)
    return true
  }
  function resetAllocation(rowKey, keyResolver = approvalSourceKey) {
    const entries = findEntries(rowKey, keyResolver)
    if (!entries.length) return false
    const source = entries.find(entry => text(entry.row.Code))?.row || entries[0].row
    const totalQty = approvalRequestedQty(entries.map(entry => entry.row))
    return replaceApprovalEntries(entries, [{ ...source, WarehouseCode: '', StorageName: '', Quantity: totalQty, Progress: 'PENDING', Status: 'Active', _approvalSourceKey: rowKey, _approvalRequestedQty: totalQty }])
  }
  function updateAllocation(index, patch) { updateRow(index, { ...patch, Progress: 'ALLOCATED' }) }
  function splitAllocation(index, allocatedQty) {
    const source = rows.value[index]
    const qty = Math.floor(toNumber(allocatedQty))
    const originalQty = toNumber(source?.Quantity)
    if (!source || qty <= 0 || qty >= originalQty) return false
    rows.value[index] = { ...source, Quantity: qty, Progress: 'ALLOCATED' }
    rows.value.splice(index + 1, 0, { SKU: source.SKU, Quantity: originalQty - qty, Progress: 'PENDING', Status: 'Active', AccessRegion: source.AccessRegion })
    return true
  }
  function addRow() { rows.value.push({ SKU: '', Quantity: 1, Progress: 'PENDING', Status: 'Active' }) }
  function updateRow(index, patch) { rows.value[index] = { ...rows.value[index], ...patch } }
  function removeRow(index) { rows.value.splice(index, 1) }
  function getRestock(code) { return restocks.items.value.find(row => row.Code === code) || null }
  function childItems(code) { return restockItems.items.value.filter(row => row.OutletRestockCode === code).filter(active) }
  function itemProgressSummary(restock = {}) {
    const children = childItems(restock.Code)
    const counts = children.reduce((acc, row) => { const key = text(row.Progress) || 'PENDING'; acc[key] = (acc[key] || 0) + 1; return acc }, {})
    const parts = ['ALLOCATED', 'PENDING', 'DELIVERED'].filter(key => counts[key]).map(key => `${counts[key]} ${key.toLowerCase()}`)
    return `${children.length} item${children.length === 1 ? '' : 's'}${parts.length ? ` - ${parts.join(', ')}` : ''}`
  }
  function storageOptionsForSku(sku) {
    return warehouseStorages.items.value.filter(active).filter(row => text(row.SKU) === text(sku) && toNumber(row.Quantity) > 0).map(row => ({ label: `${row.WarehouseCode || 'Warehouse'} - ${row.StorageName} - Available ${toNumber(row.Quantity)}`, value: `${row.WarehouseCode}|${row.StorageName}`, available: toNumber(row.Quantity), storage: row.StorageName, warehouseCode: row.WarehouseCode }))
  }
  function allocationAvailable(row = {}) { return warehouseAvailableQty(warehouseStorages.items.value, row) }
  function restockProgressFromRows(itemRows = rows.value) { return computeRestockProgressFromItems(itemRows) }
  function navigateTo(code) { nav.goTo('view', { code }) }
  function navigateToAdd(outletCode) { nav.goTo('add', outletCode ? { query: { outletCode } } : {}) }
  function cancel() { nav.goTo('list') }
  function notifyWarning(message) { $q.notify({ type: 'warning', message, position: 'top' }); return false }
  function notifyError(message) { $q.notify({ type: 'negative', message, position: 'top' }); return false }

  return {
    loading, saving, searchTerm, form, rows, items, groups, outletOptions, skuOptions, restockItems, approvalAllocationGroups, pendingAllocationGroups, pendingAllocationDraftRows, hasAllocatedApprovalRows, hasNewAllocatedRows, resourcePerms, canCreate, canApprove,
    reload, reloadIndex, reloadAdd, reloadView, loadRestock, saveRestockDraft, submitRestock, approveRestock, allocatePendingRestockItems, cancelPendingRestockItems, rejectRestock, sendBackRestock,
    resolveRestockViewMode, addRow, updateRow, removeRow, getRestock, childItems, progressMeta, storageOptionsForSku, allocationAvailable,
    approvalSourceKey, pendingAllocationSourceKey, applyRecommendedAllocation, updateAllocationRow, updateAllocationLine, updateCandidateLine, updatePendingCandidateLine, cancelPendingSelection, addAllocationSplit, removeAllocationLine, resetAllocation,
    updateAllocation, splitAllocation, allocatedRows, itemProgressSummary, restockProgressFromRows, appendWorkflowComment, formatWorkflowCommentHtml,
    navigateTo, navigateToAdd, cancel
  }
}
