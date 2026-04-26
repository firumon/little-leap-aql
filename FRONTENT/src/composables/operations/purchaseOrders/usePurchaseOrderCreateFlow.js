import { ref, computed } from 'vue';
import { useResourceData } from '../../resources/useResourceData.js';
import { useWorkflowStore } from '../../../stores/workflow.js';
import { useResourceNav } from '../../resources/useResourceNav.js';
import { useAuthStore } from '../../../stores/auth.js';
import { useQuasar } from 'quasar';
import { defaultHeaderForm, defaultItemForm, buildHeaderRecord, buildItemRecord, validatePurchaseOrder, normalizeFlag, normalizeNumber } from './purchaseOrderPayload.js';
import { usePurchaseOrderQuantities } from './usePurchaseOrderQuantities.js';
import { usePurchaseOrderTotals } from './usePurchaseOrderTotals.js';

function responseFailed(response) {
    return !response?.success || (Array.isArray(response.data) && response.data.some((entry) => entry?.success === false));
}

function firstFailureMessage(response, fallback) {
    const failed = Array.isArray(response?.data) ? response.data.find((entry) => entry?.success === false) : null;
    return failed?.error || failed?.message || response?.error || fallback;
}

function resultCode(entry) {
    return entry?.data?.result?.parentCode || entry?.data?.result?.code || entry?.data?.code || '';
}

function text(value) {
    return (value || '').toString().trim();
}

function parseActions(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function quantityMatches(left, right) {
    return Math.abs(normalizeNumber(left) - normalizeNumber(right)) < 0.000001;
}

function closeComment(userLabel) {
    return `${userLabel}/system: Complete purchase order created, hence closing RFQ`;
}

export function usePurchaseOrderCreateFlow() {
    const $q = useQuasar();
    const auth = useAuthStore();
    const supplierQuotationsResource = useResourceData(ref('SupplierQuotations'));
    const quotationItemsResource = useResourceData(ref('SupplierQuotationItems'));
    const purchaseOrdersResource = useResourceData(ref('PurchaseOrders'));
    const purchaseOrderItemsResource = useResourceData(ref('PurchaseOrderItems'));
    const suppliersResource = useResourceData(ref('Suppliers'));
    const warehousesResource = useResourceData(ref('Warehouses'));
    const rfqsResource = useResourceData(ref('RFQs'));
    const purchaseRequisitionsResource = useResourceData(ref('PurchaseRequisitions'));
    const prItemsResource = useResourceData(ref('PurchaseRequisitionItems'));
    const procurementsResource = useResourceData(ref('Procurements'));
    const workflowStore = useWorkflowStore();
    const nav = useResourceNav();

    const loading = ref(false);
    const saving = ref(false);
    const selectedQuotationCode = ref(null);
    const form = ref(defaultHeaderForm({}));
    const items = ref([]);

    const quotations = computed(() => supplierQuotationsResource.items.value);
    const quotationItems = computed(() => quotationItemsResource.items.value);
    const rfqs = computed(() => rfqsResource.items.value);
    const purchaseRequisitions = computed(() => purchaseRequisitionsResource.items.value);
    const suppliers = computed(() => suppliersResource.items.value);
    const warehouses = computed(() => warehousesResource.items.value);
    const prItems = computed(() => prItemsResource.items.value);
    const procurements = computed(() => procurementsResource.items.value);

    const { remainingQtyForItem, hasBlockingFullPo } = usePurchaseOrderQuantities(purchaseOrdersResource.items, purchaseOrderItemsResource.items, selectedQuotationCode);
    const { itemSubtotal, extraChargesTotal, suggestedTotal, syncAllTotals } = usePurchaseOrderTotals({ form, items, isCreateMode: true });

    const eligibleQuotations = computed(() => {
        return quotations.value.filter(sq =>
            sq.Status === 'Active' &&
            sq.ResponseType !== 'DECLINED' &&
            sq.Progress !== 'REJECTED'
        ).map(sq => ({
            label: `${sq.Code} (${sq.SupplierCode}) - ${sq.Currency} ${sq.TotalAmount}`,
            value: sq.Code,
            quotation: sq
        }));
    });

    const selectedQuotation = computed(() => {
        if (!selectedQuotationCode.value) return null;
        return quotations.value.find(sq => sq.Code === selectedQuotationCode.value);
    });

    const selectedRfq = computed(() => {
        if (!selectedQuotation.value?.RFQCode) return null;
        return rfqs.value.find(row => row.Code === selectedQuotation.value.RFQCode) || null;
    });

    const rfqCloseAction = computed(() => {
        const resourceEntries = Array.isArray(auth.resources) ? auth.resources : (auth.resources?.value || []);
        const resource = resourceEntries.find(entry => entry?.name === 'RFQs' || entry?.Name === 'RFQs');
        const actions = parseActions(resource?.additionalActions || resource?.AdditionalActions);
        const action = actions.find(entry =>
            entry?.kind !== 'navigate' &&
            (entry?.action === 'Close' || entry?.action === 'CloseRFQ') &&
            (entry?.columnValue || entry?.mutate?.columnValue) === 'CLOSED'
        );
        if (!action) return null;
        const mutate = action.mutate || {};
        return {
            actionName: action.action,
            column: mutate.column || action.column || 'Progress',
            columnValue: mutate.columnValue || action.columnValue || 'CLOSED',
            fields: {}
        };
    });

    const allowPartial = computed(() => {
        if (!selectedQuotation.value) return false;
        return normalizeFlag(selectedQuotation.value.AllowPartialPO);
    });

    const supplierName = computed(() => {
        if (!selectedQuotation.value) return '';
        const sup = suppliers.value.find(s => s.Code === selectedQuotation.value.SupplierCode);
        return sup ? sup.Name : selectedQuotation.value.SupplierCode;
    });

    const warehouseOptions = computed(() => {
        return warehouses.value.filter(w => w.Status === 'Active').map(w => ({
            label: `${w.Name} (${w.Code})`,
            value: w.Code
        }));
    });

    const loadData = async (forceSync = false) => {
        loading.value = true;
        try {
            await workflowStore.fetchResources([
                'SupplierQuotations',
                'SupplierQuotationItems',
                'PurchaseOrders',
                'PurchaseOrderItems',
                'Suppliers',
                'Warehouses',
                'RFQs',
                'PurchaseRequisitions',
                'PurchaseRequisitionItems',
                'Procurements'
            ], {
                includeInactive: true,
                forceSync
            });
        } finally {
            loading.value = false;
        }
    };

    const selectQuotation = (code) => {
        selectedQuotationCode.value = code;
        if (!code) {
            form.value = defaultHeaderForm({});
            items.value = [];
            return;
        }

        const sq = quotations.value.find(q => q.Code === code);
        const rfq = rfqs.value.find(row => row.Code === sq?.RFQCode);
        const sourcePr = purchaseRequisitions.value.find(row => row.Code === rfq?.PurchaseRequisitionCode);
        form.value = defaultHeaderForm({
            quotation: sq,
            seed: {
                ShipToWarehouseCode: sourcePr?.WarehouseCode || ''
            }
        });

        const sqItems = quotationItems.value.filter(i => i.SupplierQuotationCode === code && i.Status === 'Active');

        items.value = sqItems.map(sqi => {
            const prItem = prItems.value.find(p => p.Code === sqi.PurchaseRequisitionItemCode);
            const remainingQty = remainingQtyForItem.value(sqi);
            return defaultItemForm({
                quotationItem: sqi,
                prItem,
                remainingQty,
                allowPartial: allowPartial.value
            });
        });

        syncAllTotals();
    };

    const toggleItem = (item) => {
        if (!allowPartial.value) return;
        item.Selected = !item.Selected;
        syncAllTotals();
    };

    function currentUserLabel() {
        return auth.user?.name || auth.user?.email || auth.user?.id || 'Unknown User';
    }

    function quotationItemByCode(code) {
        return quotationItems.value.find(item => item.Code === code) || null;
    }

    function selectedRfqItemCodes() {
        return text(selectedRfq.value?.PurchaseRequisitionItemsCode)
            .split(',')
            .map(entry => entry.trim())
            .filter(Boolean);
    }

    function rfqRequiredQtyByPrItemCode() {
        const codes = selectedRfqItemCodes();
        const codeSet = new Set(codes);
        const required = new Map();
        prItems.value
            .filter(item => codeSet.has(text(item.Code)))
            .forEach(item => required.set(text(item.Code), normalizeNumber(item.Quantity)));
        return required.size === codes.length ? required : new Map();
    }

    function coveredQtyByPrItemCode(selectedItems = []) {
        const rfqCode = text(selectedRfq.value?.Code);
        const covered = new Map();
        const activePoCodes = new Set(
            purchaseOrdersResource.items.value
                .filter(po =>
                    text(po.RFQCode) === rfqCode &&
                    text(po.Status || 'Active') === 'Active' &&
                    text(po.Progress).toUpperCase() !== 'CANCELLED'
                )
                .map(po => text(po.Code))
                .filter(Boolean)
        );

        purchaseOrderItemsResource.items.value
            .filter(item => activePoCodes.has(text(item.PurchaseOrderCode)) && text(item.Status || 'Active') === 'Active')
            .forEach(item => {
                const quotationItem = quotationItemByCode(item.SupplierQuotationItemCode);
                const prItemCode = text(quotationItem?.PurchaseRequisitionItemCode);
                if (!prItemCode) return;
                covered.set(prItemCode, normalizeNumber(covered.get(prItemCode)) + normalizeNumber(item.OrderedQuantity));
            });

        selectedItems.forEach(item => {
            const quotationItem = quotationItemByCode(item.SupplierQuotationItemCode);
            const prItemCode = text(quotationItem?.PurchaseRequisitionItemCode);
            if (!prItemCode) return;
            covered.set(prItemCode, normalizeNumber(covered.get(prItemCode)) + normalizeNumber(item.OrderedQuantity));
        });

        return covered;
    }

    function shouldOfferRfqClose(selectedItems = []) {
        if (!selectedRfq.value || text(selectedRfq.value.Progress).toUpperCase() === 'CLOSED' || !rfqCloseAction.value) {
            return false;
        }
        const required = rfqRequiredQtyByPrItemCode();
        if (!required.size) return false;
        const covered = coveredQtyByPrItemCode(selectedItems);
        return Array.from(required.entries()).every(([prItemCode, requiredQty]) =>
            quantityMatches(covered.get(prItemCode), requiredQty)
        );
    }

    function confirmRfqClose() {
        return new Promise(resolve => {
            let settled = false;
            $q.dialog({
                title: 'Close RFQ?',
                message: `This PO fully covers RFQ ${selectedRfq.value.Code}. Closing the RFQ will stop further supplier quotations for it.`,
                persistent: true,
                ok: { label: 'Create PO and close RFQ', color: 'negative' },
                cancel: { label: 'Create PO only', flat: true }
            })
                .onOk(() => {
                    settled = true;
                    resolve(true);
                })
                .onCancel(() => {
                    settled = true;
                    resolve(false);
                })
                .onDismiss(() => {
                    if (!settled) resolve(false);
                });
        });
    }

    const save = async () => {
        const { success, errors, selectedItems } = validatePurchaseOrder({
            form: form.value,
            items: items.value,
            selectedQuotation: selectedQuotation.value,
            allowPartial: allowPartial.value,
            hasBlockingFullPo: hasBlockingFullPo.value
        });

        if (!success) {
            $q.notify({ type: 'warning', message: errors[0], position: 'top' });
            return;
        }

        const closeRfq = shouldOfferRfqClose(selectedItems) ? await confirmRfqClose() : false;

        saving.value = true;
        try {
            syncAllTotals();
            const batchPayload = [];

            const headerPayload = buildHeaderRecord(form.value);
            const itemsPayload = selectedItems.map(item => ({ _action: 'create', data: buildItemRecord(item) }));

            const compositeRequest = {
                action: 'compositeSave',
                resource: 'PurchaseOrders',
                payload: {
                    data: headerPayload,
                    children: [
                        {
                            resource: 'PurchaseOrderItems',
                            records: itemsPayload
                        }
                    ]
                }
            };
            batchPayload.push(compositeRequest);

            if (selectedQuotation.value?.Code && selectedQuotation.value.Progress !== 'ACCEPTED') {
                batchPayload.push({
                    action: 'update',
                    resource: 'SupplierQuotations',
                    payload: {
                        code: selectedQuotation.value.Code,
                        data: { Progress: 'ACCEPTED' }
                    }
                });
            }

            if (closeRfq && selectedRfq.value?.Code && rfqCloseAction.value) {
                batchPayload.push({
                    action: 'executeAction',
                    resource: 'RFQs',
                    payload: {
                        code: selectedRfq.value.Code,
                        actionName: rfqCloseAction.value.actionName,
                        column: rfqCloseAction.value.column,
                        columnValue: rfqCloseAction.value.columnValue,
                        fields: {
                            ...rfqCloseAction.value.fields,
                            ProgressClosedComment: closeComment(currentUserLabel())
                        }
                    }
                });
            }

            if (selectedQuotation.value && selectedQuotation.value.ProcurementCode) {
                const proc = procurements.value.find(p => p.Code === selectedQuotation.value.ProcurementCode);
                if (proc && proc.Progress === 'QUOTATIONS_RECEIVED') {
                    batchPayload.push({
                        action: 'update',
                        resource: 'Procurements',
                        payload: {
                            code: proc.Code,
                            data: { Progress: 'PO_ISSUED' }
                        }
                    });
                }
            }

            batchPayload.push({
                action: 'get',
                resource: ['PurchaseOrders', 'PurchaseOrderItems', 'SupplierQuotations', 'RFQs', 'Procurements'],
                payload: { includeInactive: true }
            });

            const result = await workflowStore.runBatchRequests(batchPayload);

            if (responseFailed(result)) {
                $q.notify({ type: 'negative', message: firstFailureMessage(result, 'Failed to save Purchase Order'), position: 'top' });
                return;
            }

            $q.notify({ type: 'positive', message: 'Purchase Order created successfully', position: 'top' });
            const code = resultCode(result.data?.[0]);
            if (code) {
                nav.goTo('view', { code });
            } else {
                nav.goTo('list');
            }
        } finally {
            saving.value = false;
        }
    };

    const cancel = () => {
        nav.goTo('list');
    };

    return {
        loading,
        saving,
        selectedQuotationCode,
        eligibleQuotations,
        selectedQuotation,
        supplierName,
        allowPartial,
        warehouseOptions,
        form,
        items,
        itemSubtotal,
        extraChargesTotal,
        suggestedTotal,
        hasBlockingFullPo,
        loadData,
        selectQuotation,
        toggleItem,
        save,
        cancel
    };
}
