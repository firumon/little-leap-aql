import { computed, watch } from 'vue';
import { normalizeNumber, lineTotal, stringifyCharges, parseCharges } from './purchaseOrderPayload.js';
import { EXTRA_CHARGE_KEYS } from './purchaseOrderMeta.js';

export function usePurchaseOrderTotals({ form, items, isCreateMode }) {
    const itemSubtotal = computed(() => {
        const arr = items.value || [];
        return arr.reduce((sum, item) => {
            if (isCreateMode && !item.Selected) return sum;
            return sum + lineTotal(item);
        }, 0);
    });

    const extraChargesTotal = computed(() => {
        const charges = parseCharges(form.value.ExtraChargesBreakup);
        return EXTRA_CHARGE_KEYS.reduce((sum, key) => sum + normalizeNumber(charges[key]), 0);
    });

    const suggestedTotal = computed(() => {
        return itemSubtotal.value + extraChargesTotal.value;
    });

    const syncAllTotals = () => {
        form.value.SubtotalAmount = itemSubtotal.value;
        form.value.TotalAmount = suggestedTotal.value;
    };

    watch([itemSubtotal, extraChargesTotal], () => {
        syncAllTotals();
    }, { deep: true });

    return {
        itemSubtotal,
        extraChargesTotal,
        suggestedTotal,
        syncAllTotals
    };
}
