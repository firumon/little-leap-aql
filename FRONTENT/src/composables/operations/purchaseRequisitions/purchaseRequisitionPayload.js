function unwrapFieldValue(value) {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value || ''
  }
  return value || ''
}

export function buildPurchaseRequisitionFormData(form = {}, { targetProgress, responseComment = '', appendResponseComment = false } = {}) {
  const baseComment = form.ProgressReviewComment || ''
  const nextComment = appendResponseComment && responseComment
    ? `${baseComment}\n[Response]: ${responseComment}`
    : baseComment

  return {
    Type: unwrapFieldValue(form.Type),
    Priority: unwrapFieldValue(form.Priority),
    WarehouseCode: unwrapFieldValue(form.WarehouseCode),
    RequiredDate: form.RequiredDate || '',
    TypeReferenceCode: form.TypeReferenceCode || '',
    Progress: targetProgress ?? unwrapFieldValue(form.Progress),
    ProgressReviewComment: nextComment || ''
  }
}

export function buildPurchaseRequisitionCreateItemRecords(items = []) {
  return items.map((item) => ({
    _action: 'create',
    data: {
      SKU: item.Code,
      UOM: item.UOM || '',
      Quantity: item.requiredQuantity,
      EstimatedRate: 0
    }
  }))
}

export function buildPurchaseRequisitionItemRecords(items = [], deletedItemCodes = []) {
  return [
    ...items.map((item) => ({
      _action: item.Code ? 'update' : 'create',
      _originalCode: item.Code || '',
      data: {
        SKU: item.SKU,
        UOM: item.UOM,
        Quantity: item.Quantity,
        EstimatedRate: item.EstimatedRate,
        Status: 'Active'
      }
    })),
    ...deletedItemCodes.map((code) => ({
      _action: 'deactivate',
      _originalCode: code,
      data: { Status: 'Inactive' }
    }))
  ]
}

export function buildPurchaseRequisitionPayload({
  prCode,
  form,
  targetProgress,
  items = [],
  deletedItemCodes = [],
  responseComment = '',
  appendResponseComment = false
}) {
  return {
    action: 'compositeSave',
    resource: 'PurchaseRequisitions',
    scope: 'operation',
    code: prCode,
    data: buildPurchaseRequisitionFormData(form, {
      targetProgress,
      responseComment,
      appendResponseComment
    }),
    children: [{
      resource: 'PurchaseRequisitionItems',
      records: buildPurchaseRequisitionItemRecords(items, deletedItemCodes)
    }]
  }
}

