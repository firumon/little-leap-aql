import { ref, computed } from 'vue';
import { useResourceData } from '../../resources/useResourceData.js';
import { useResourceConfig } from '../../resources/useResourceConfig.js';
import { useResourceNav } from '../../resources/useResourceNav.js';
import { useWorkflowStore } from '../../../stores/workflow.js';
import { PROGRESS_ORDER, formatDate, formatCurrency } from './purchaseOrderMeta.js';

function text(value) {
    return value == null ? '' : String(value);
}

function sortableTime(row = {}) {
    const value = row.CreatedAt || row.UpdatedAt || row.PODate || '';
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Date.parse(text(value));
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function usePurchaseOrderIndex() {
    const { permissions } = useResourceConfig();
    const purchaseOrders = useResourceData(ref('PurchaseOrders'));
    const suppliersResource = useResourceData(ref('Suppliers'));
    const workflowStore = useWorkflowStore();
    const nav = useResourceNav();

    const loading = ref(false);
    const searchTerm = ref('');
    const expandedGroups = ref({ CREATED: true });

    const rawOrders = computed(() => {
        return purchaseOrders.items.value.filter(r => r.Status === 'Active');
    });

    const suppliers = computed(() => {
        return suppliersResource.items.value.reduce((acc, sup) => {
            acc[sup.Code] = sup.Name;
            return acc;
        }, {});
    });

    const items = computed(() => {
        let filtered = rawOrders.value;
        if (searchTerm.value) {
            const term = searchTerm.value.toLowerCase();
            filtered = filtered.filter(po => {
                return (
                    text(po.Code).toLowerCase().includes(term) ||
                    text(po.SupplierCode).toLowerCase().includes(term) ||
                    text(po.RFQCode).toLowerCase().includes(term) ||
                    text(po.SupplierQuotationCode).toLowerCase().includes(term)
                );
            });
        }
        return filtered;
    });

    const groups = computed(() => {
        const groupMap = {};
        PROGRESS_ORDER.forEach(p => { groupMap[p] = []; });

        items.value.forEach(item => {
            const prog = PROGRESS_ORDER.includes(item.Progress) ? item.Progress : 'OTHER';
            groupMap[prog].push(item);
        });

        return PROGRESS_ORDER.map(prog => ({
            name: prog,
            items: groupMap[prog].sort((a, b) => sortableTime(b) - sortableTime(a) || text(b.Code).localeCompare(text(a.Code)))
        })).filter(g => g.items.length > 0);
    });

    const totalVisible = computed(() => {
        return items.value.length;
    });

    const reload = async (forceSync = false) => {
        loading.value = true;
        try {
            await workflowStore.fetchResources(['PurchaseOrders', 'Suppliers', 'Warehouses'], {
                includeInactive: true,
                forceSync
            });
        } finally {
            loading.value = false;
        }
    };

    const isGroupExpanded = (groupName) => {
        return !!expandedGroups.value[groupName];
    };

    const toggleGroup = (groupName) => {
        expandedGroups.value[groupName] = !expandedGroups.value[groupName];
    };

    const supplierName = (code) => {
        return suppliers.value[code] || code;
    };

    const navigateTo = (rowOrCode) => {
        const code = typeof rowOrCode === 'string' ? rowOrCode : rowOrCode?.Code;
        if (!code) return;
        nav.goTo('view', { code });
    };

    const navigateToAdd = () => {
        nav.goTo('add');
    };

    return {
        permissions,
        items,
        loading,
        searchTerm,
        groups,
        totalVisible,
        reload,
        isGroupExpanded,
        toggleGroup,
        navigateTo,
        navigateToAdd,
        supplierName,
        formatDate,
        formatCurrency
    };
}
