import { ref, computed } from 'vue';
import { useResourceConfig, isActionVisible } from '../../resources/useResourceConfig.js';
import { useResourceData } from '../../resources/useResourceData.js';
import { useWorkflowStore } from '../../../stores/workflow.js';
import { useResourceNav } from '../../resources/useResourceNav.js';
import { useQuasar } from 'quasar';
import { progressMeta, labelFor, formatDate, formatCurrency } from './purchaseOrderMeta.js';
import { parseCharges, normalizeNumber, lineTotal } from './purchaseOrderPayload.js';

function responseFailed(response) {
    return !response?.success || (Array.isArray(response.data) && response.data.some((entry) => entry?.success === false));
}

function firstFailureMessage(response, fallback) {
    const failed = Array.isArray(response?.data) ? response.data.find((entry) => entry?.success === false) : null;
    return failed?.error || failed?.message || response?.error || fallback;
}

function text(value) {
    return (value || '').toString().trim();
}

function extractResourceDeltaRecord(resourceDelta, headers = []) {
    if (!resourceDelta || typeof resourceDelta !== 'object') return null;

    const firstRow = Array.isArray(resourceDelta.records) && resourceDelta.records.length
        ? resourceDelta.records[0]
        : (Array.isArray(resourceDelta.rows) && resourceDelta.rows.length ? resourceDelta.rows[0] : null);

    if (!firstRow) return null;
    if (!Array.isArray(firstRow)) {
        return firstRow;
    }

    if (!Array.isArray(headers) || !headers.length) {
        return null;
    }

    return headers.reduce((acc, header, index) => {
        acc[header] = firstRow[index] ?? '';
        return acc;
    }, {});
}

export function usePurchaseOrderView() {
    const $q = useQuasar();
    const { code, additionalActions } = useResourceConfig();
    const purchaseOrders = useResourceData(ref('PurchaseOrders'));
    const purchaseOrderItems = useResourceData(ref('PurchaseOrderItems'));
    const supplierQuotations = useResourceData(ref('SupplierQuotations'));
    const quotationItems = useResourceData(ref('SupplierQuotationItems'));
    const suppliers = useResourceData(ref('Suppliers'));
    const warehouses = useResourceData(ref('Warehouses'));
    const rfqs = useResourceData(ref('RFQs'));
    const rfqSuppliers = useResourceData(ref('RFQSuppliers'));
    const procurements = useResourceData(ref('Procurements'));
    const workflowStore = useWorkflowStore();
    const nav = useResourceNav();

    const loading = ref(false);
    const acting = ref(false);
    const actionComment = ref('');

    const record = computed(() => {
        if (!code.value) return null;
        return purchaseOrders.items.value.find(p => p.Code === code.value);
    });

    const items = computed(() => {
        if (!code.value) return [];
        return purchaseOrderItems.items.value.filter(i => i.PurchaseOrderCode === code.value && i.Status === 'Active');
    });

    const quotation = computed(() => {
        if (!record.value) return null;
        return supplierQuotations.items.value.find(q => q.Code === record.value.SupplierQuotationCode);
    });

    const supplier = computed(() => {
        if (!record.value) return null;
        return suppliers.items.value.find(s => s.Code === record.value.SupplierCode);
    });

    const warehouse = computed(() => {
        if (!record.value) return null;
        return warehouses.items.value.find(w => w.Code === record.value.ShipToWarehouseCode);
    });

    const rfq = computed(() => {
        if (!record.value?.RFQCode) return null;
        return rfqs.items.value.find(row => row.Code === record.value.RFQCode) || null;
    });

    const progress = computed(() => {
        if (!record.value) return progressMeta('OTHER');
        return progressMeta(record.value.Progress);
    });

    const subtotalAmount = computed(() => {
        return items.value.reduce((sum, item) => sum + lineTotal(item), 0);
    });

    const extraCharges = computed(() => {
        if (!record.value) return {};
        return parseCharges(record.value.ExtraChargesBreakup);
    });

    const availableActions = computed(() => {
        if (!record.value) return [];
        return additionalActions.value.filter(a => isActionVisible(a, record.value));
    });

    const loadData = async (forceSync = false) => {
        loading.value = true;
        try {
            await Promise.all([
                purchaseOrders.reload(forceSync),
                purchaseOrderItems.reload(forceSync),
                supplierQuotations.reload(forceSync),
                quotationItems.reload(forceSync),
                suppliers.reload(forceSync),
                warehouses.reload(forceSync),
                rfqs.reload(forceSync),
                rfqSuppliers.reload(forceSync),
                procurements.reload(forceSync)
            ]);
        } finally {
            loading.value = false;
        }
    };

    function matchingRfqSupplierRows() {
        if (!record.value?.RFQCode || !record.value?.SupplierCode) return [];
        return rfqSuppliers.items.value.filter(row =>
            text(row.RFQCode) === text(record.value.RFQCode) &&
            text(row.SupplierCode) === text(record.value.SupplierCode) &&
            text(row.Status || 'Active') === 'Active'
        );
    }

    function procurement() {
        if (!record.value?.ProcurementCode) return null;
        return procurements.items.value.find(row => text(row.Code) === text(record.value.ProcurementCode)) || null;
    }

    function hasOtherActiveIssuedPurchaseOrders() {
        if (!record.value?.ProcurementCode) return false;
        return purchaseOrders.items.value.some(row =>
            text(row.Code) !== text(record.value.Code) &&
            text(row.ProcurementCode) === text(record.value.ProcurementCode) &&
            text(row.Status || 'Active') === 'Active' &&
            text(row.Progress).toUpperCase() !== 'CANCELLED'
        );
    }

    function buildExecuteActionRequest(actionConfig, fields = {}) {
        return {
            action: 'executeAction',
            resource: 'PurchaseOrders',
            payload: {
                code: record.value.Code,
                actionName: actionConfig.action,
                column: actionConfig.column,
                columnValue: actionConfig.columnValue,
                fields
            }
        };
    }

    async function runCancelAction(actionConfig, fields = {}) {
        const requests = [buildExecuteActionRequest(actionConfig, fields)];

        matchingRfqSupplierRows()
            .filter(row => text(row.Progress).toUpperCase() !== 'CANCELLED')
            .forEach(row => {
                requests.push({
                    action: 'update',
                    resource: 'RFQSuppliers',
                    payload: {
                        code: row.Code,
                        data: { Progress: 'CANCELLED' }
                    }
                });
            });

        const linkedProcurement = procurement();
        if (
            linkedProcurement?.Code &&
            text(linkedProcurement.Progress).toUpperCase() === 'PO_ISSUED' &&
            !hasOtherActiveIssuedPurchaseOrders()
        ) {
            requests.push({
                action: 'update',
                resource: 'Procurements',
                payload: {
                    code: linkedProcurement.Code,
                    data: { Progress: 'QUOTATIONS_RECEIVED' }
                }
            });
        }

        if (text(rfq.value?.Progress).toUpperCase() === 'CLOSED') {
            requests.push({
                action: 'update',
                resource: 'RFQs',
                payload: {
                    code: rfq.value.Code,
                    data: {
                        Progress: 'SENT',
                        ProgressClosedComment: ''
                    }
                }
            });
        }

        return workflowStore.runBatchRequests(requests);
    }

    const runAction = async (actionConfig) => {
        if (!record.value?.Code || !actionConfig) return;

        const comment = actionComment.value.trim();
        if (actionConfig.fields && actionConfig.fields.find(f => f.name === 'Comment' && f.required) && !comment) {
            $q.notify({ type: 'warning', message: 'Comment is required for this action.', position: 'top' });
            return;
        }

        acting.value = true;
        try {
            const actionTargetValue = actionConfig.columnValue;
            let commentField = '';
            if (actionTargetValue === 'SENT') commentField = 'ProgressSentComment';
            else if (actionTargetValue === 'ACKNOWLEDGED') commentField = 'ProgressAcknowledgedComment';
            else if (actionTargetValue === 'ACCEPTED') commentField = 'ProgressAcceptedComment';
            else if (actionTargetValue === 'CANCELLED') commentField = 'ProgressCancelledComment';

            const payloadData = {};
            if (commentField && comment) {
                payloadData[commentField] = comment;
            }

            const result = actionTargetValue === 'CANCELLED'
                ? await runCancelAction(actionConfig, payloadData)
                : await workflowStore.executeResourceAction('PurchaseOrders', record.value.Code, actionConfig, payloadData);

            if (responseFailed(result)) {
                $q.notify({ type: 'negative', message: firstFailureMessage(result, `Failed to execute ${actionConfig.label}`), position: 'top' });
                return;
            }

            $q.notify({ type: 'positive', message: `Action ${actionConfig.label} successful`, position: 'top' });
            if (actionTargetValue !== 'CANCELLED') {
                const updatedRecord = extractResourceDeltaRecord(result?.data?.PurchaseOrders, purchaseOrders.lastHeaders.value);
                if (updatedRecord?.Code) {
                    await purchaseOrders.updateLocalRecord(updatedRecord);
                }
            }
            actionComment.value = '';
        } finally {
            acting.value = false;
        }
    };

    const goToList = () => {
        nav.goTo('list');
    };

    return {
        loading,
        acting,
        record,
        items,
        quotation,
        supplier,
        warehouse,
        progress,
        availableActions,
        actionComment,
        subtotalAmount,
        extraCharges,
        loadData,
        runAction,
        goToList,
        labelFor,
        formatDate,
        formatCurrency,
        normalizeNumber,
        lineTotal
    };
}
