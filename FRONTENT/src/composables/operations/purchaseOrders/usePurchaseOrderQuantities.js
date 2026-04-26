import { computed } from 'vue';
import { normalizeNumber } from './purchaseOrderPayload.js';

export function usePurchaseOrderQuantities(purchaseOrders, purchaseOrderItems, selectedQuotationCode) {
    const activePurchaseOrdersForQuotation = computed(() => {
        const sqCode = selectedQuotationCode.value;
        if (!sqCode) return [];
        return (purchaseOrders.value || []).filter(po =>
            po.SupplierQuotationCode === sqCode &&
            po.Status === 'Active' &&
            po.Progress !== 'CANCELLED'
        );
    });

    const orderedQtyBySupplierQuotationItemCode = computed(() => {
        const acc = {};
        const activePoCodes = new Set(activePurchaseOrdersForQuotation.value.map(po => po.Code));

        (purchaseOrderItems.value || []).forEach(item => {
            if (activePoCodes.has(item.PurchaseOrderCode)) {
                const sqiCode = item.SupplierQuotationItemCode;
                const qty = normalizeNumber(item.OrderedQuantity);
                acc[sqiCode] = (acc[sqiCode] || 0) + qty;
            }
        });
        return acc;
    });

    const remainingQtyForItem = computed(() => {
        return (sqItem) => {
            if (!sqItem) return 0;
            const quoted = normalizeNumber(sqItem.Quantity);
            const ordered = orderedQtyBySupplierQuotationItemCode.value[sqItem.Code] || 0;
            return Math.max(0, quoted - ordered);
        };
    });

    const hasBlockingFullPo = computed(() => {
        return activePurchaseOrdersForQuotation.value.length > 0;
    });

    return {
        activePurchaseOrdersForQuotation,
        orderedQtyBySupplierQuotationItemCode,
        remainingQtyForItem,
        hasBlockingFullPo
    };
}
