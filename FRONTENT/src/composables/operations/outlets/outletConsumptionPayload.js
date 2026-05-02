import { todayISO, text, OUTLET_REFERENCE_TYPES } from './outletOperationsMeta.js'
import { toNumber } from './outletStockLogic.js'
import { compositeSaveRequest, resourceBulkRequest } from './outletOperationsBatch.js'

export function buildConsumptionCompositePayload(form = {}, rows = []) {
  return { resource: 'OutletConsumption', code: form.Code, data: { OutletCode: text(form.OutletCode), ConsumptionDate: text(form.ConsumptionDate) || todayISO(), RecordedByUserCode: text(form.RecordedByUserCode), Progress: 'CONFIRMED', Remarks: text(form.Remarks), Status: 'Active', AccessRegion: text(form.AccessRegion) }, children: [{ resource: 'OutletConsumptionItems', records: rows.filter(row => toNumber(row.ConsumedQty) > 0).map(row => ({ _action: row.Code ? 'update' : 'create', ...(row.Code ? { _originalCode: row.Code } : {}), data: { SKU: text(row.SKU), ConsumedQty: toNumber(row.ConsumedQty), Remarks: text(row.Remarks), Status: 'Active' } })) }] }
}

export function buildConsumptionMovementRequests(consumptionCode, outletCode, rows = [], form = {}) {
  return resourceBulkRequest('OutletMovements', rows.filter(row => toNumber(row.ConsumedQty) > 0).map(row => ({ OutletCode: outletCode, SKU: row.SKU, QtyChange: -Math.abs(toNumber(row.ConsumedQty)), ReferenceType: OUTLET_REFERENCE_TYPES.consumption, ReferenceCode: consumptionCode, ReferenceItemCode: row.Code || '', MovementDate: text(form.ConsumptionDate) || todayISO(), Status: 'Active', AccessRegion: text(form.AccessRegion) })), ['OutletStorages'])
}

export function consumptionSaveRequest(form, rows) { return compositeSaveRequest(buildConsumptionCompositePayload(form, rows)) }
