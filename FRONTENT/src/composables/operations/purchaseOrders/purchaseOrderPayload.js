import { EXTRA_CHARGE_KEYS } from './purchaseOrderMeta.js';

export function toDateInputValue(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
}

export function normalizeNumber(val) {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
}

export function normalizeFlag(val) {
    if (val === true || val === 'TRUE' || val === 'true' || val === 1) return true;
    return false;
}

export function flagValue(boolVal) {
    return boolVal ? 'TRUE' : 'FALSE';
}

export function blankCharges() {
    return EXTRA_CHARGE_KEYS.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
}

export function parseCharges(jsonStr) {
    if (jsonStr && typeof jsonStr === 'object' && !Array.isArray(jsonStr)) {
        return { ...blankCharges(), ...jsonStr };
    }
    try {
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed === 'object' && parsed !== null) {
            return { ...blankCharges(), ...parsed };
        }
    } catch (e) {
        // Fallback
    }
    return blankCharges();
}

export function stringifyCharges(chargesObj) {
    const clean = {};
    EXTRA_CHARGE_KEYS.forEach(key => {
        clean[key] = normalizeNumber(chargesObj[key]);
    });
    return JSON.stringify(clean);
}

export function lineTotal(item) {
    return normalizeNumber(item.OrderedQuantity) * normalizeNumber(item.UnitPrice);
}

export function defaultHeaderForm({ quotation, seed }) {
    const form = {
        ProcurementCode: '',
        RFQCode: '',
        SupplierQuotationCode: '',
        SupplierCode: '',
        PODate: new Date().toISOString().split('T')[0],
        ShipToWarehouseCode: '',
        Currency: 'AED',
        SubtotalAmount: 0,
        TotalAmount: 0,
        ExtraChargesBreakup: blankCharges(),
        Remarks: '',
        ...(seed || {})
    };

    if (quotation) {
        form.ProcurementCode = quotation.ProcurementCode;
        form.RFQCode = quotation.RFQCode;
        form.SupplierQuotationCode = quotation.Code;
        form.SupplierCode = quotation.SupplierCode;
        form.Currency = quotation.Currency || 'AED';
        form.ExtraChargesBreakup = parseCharges(quotation.ExtraChargesBreakup);
    }

    return form;
}

export function defaultItemForm({ quotationItem, prItem, remainingQty, allowPartial, seed }) {
    const qty = normalizeNumber(remainingQty);
    return {
        Selected: !allowPartial || qty > 0,
        SupplierQuotationItemCode: quotationItem?.Code || '',
        SKU: quotationItem?.SKU || '',
        Description: quotationItem?.Description || '',
        UOM: prItem?.UOM || '',
        QuotedQuantity: normalizeNumber(quotationItem?.Quantity),
        OrderedQuantity: qty,
        UnitPrice: normalizeNumber(quotationItem?.UnitPrice),
        SupplierItemCode: quotationItem?.SupplierItemCode || '',
        Remarks: quotationItem?.Remarks || '',
        RemainingQuantity: qty, // Transient display
        ...(seed || {})
    };
}

export function buildHeaderRecord(form) {
    return {
        ProcurementCode: form.ProcurementCode,
        RFQCode: form.RFQCode,
        SupplierQuotationCode: form.SupplierQuotationCode,
        SupplierCode: form.SupplierCode,
        PODate: form.PODate,
        ShipToWarehouseCode: form.ShipToWarehouseCode,
        Currency: form.Currency,
        SubtotalAmount: normalizeNumber(form.SubtotalAmount),
        TotalAmount: normalizeNumber(form.TotalAmount),
        ExtraChargesBreakup: stringifyCharges(form.ExtraChargesBreakup),
        Remarks: form.Remarks || ''
    };
}

export function buildItemRecord(itemForm) {
    return {
        SupplierQuotationItemCode: itemForm.SupplierQuotationItemCode,
        SKU: itemForm.SKU,
        Description: itemForm.Description || '',
        UOM: itemForm.UOM || '',
        QuotedQuantity: normalizeNumber(itemForm.QuotedQuantity),
        OrderedQuantity: normalizeNumber(itemForm.OrderedQuantity),
        UnitPrice: normalizeNumber(itemForm.UnitPrice),
        SupplierItemCode: itemForm.SupplierItemCode || '',
        Remarks: itemForm.Remarks || '',
        Status: 'Active'
    };
}

export function validatePurchaseOrder({ form, items, selectedQuotation, allowPartial, hasBlockingFullPo }) {
    const errors = [];
    const selectedItems = items.filter(i => i.Selected);

    if (!selectedQuotation) {
        errors.push('A supplier quotation must be selected.');
        return { success: false, errors, selectedItems: [] };
    }

    if (selectedQuotation.ResponseType === 'DECLINED') {
        errors.push('Cannot create PO from a declined quotation.');
    }
    if (selectedQuotation.Progress === 'REJECTED') {
        errors.push('Cannot create PO from a rejected quotation.');
    }

    if (!form.ShipToWarehouseCode) {
        errors.push('Ship-to warehouse is required.');
    }

    if (selectedItems.length === 0) {
        errors.push('At least one item must be selected.');
    }

    if (!allowPartial) {
        if (hasBlockingFullPo) {
            errors.push('A full purchase order already exists for this quotation.');
        }
        items.forEach((item, idx) => {
            if (!item.Selected && item.RemainingQuantity > 0) {
                errors.push(`Row ${idx + 1}: All items with remaining quantity must be selected for a full PO.`);
            }
        });
    }

    selectedItems.forEach((item, idx) => {
        const oQty = normalizeNumber(item.OrderedQuantity);
        if (oQty <= 0) {
            errors.push(`Selected row ${idx + 1} (${item.SKU}) must have an ordered quantity greater than zero.`);
        }
        if (allowPartial && oQty > item.RemainingQuantity) {
            errors.push(`Selected row ${idx + 1} (${item.SKU}) ordered quantity cannot exceed remaining quantity (${item.RemainingQuantity}).`);
        }
    });

    return {
        success: errors.length === 0,
        errors,
        selectedItems
    };
}
