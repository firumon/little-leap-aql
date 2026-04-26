export const EXTRA_CHARGE_KEYS = ['tax', 'freight', 'commission', 'handling', 'other'];

export const PROGRESS_ORDER = ['CREATED', 'SENT', 'ACKNOWLEDGED', 'ACCEPTED', 'CANCELLED', 'CLOSED', 'OTHER'];

const PROGRESS_META = {
    CREATED: { label: 'Created', color: 'blue-grey', icon: 'note_add' },
    SENT: { label: 'Sent', color: 'primary', icon: 'send' },
    ACKNOWLEDGED: { label: 'Acknowledged', color: 'info', icon: 'done' },
    ACCEPTED: { label: 'Accepted', color: 'positive', icon: 'check_circle' },
    CANCELLED: { label: 'Cancelled', color: 'negative', icon: 'cancel' },
    CLOSED: { label: 'Closed', color: 'grey-7', icon: 'archive' },
    OTHER: { label: 'Other', color: 'grey', icon: 'help_outline' }
};

export function progressMeta(progress) {
    return PROGRESS_META[progress] || PROGRESS_META.OTHER;
}

export function labelFor(key) {
    const labels = {
        tax: 'Tax',
        freight: 'Freight',
        commission: 'Commission',
        handling: 'Handling',
        other: 'Other'
    };
    return labels[key] || key;
}

export function mapOptions(optionsArray) {
    if (!Array.isArray(optionsArray)) return [];
    return optionsArray.map(opt => ({
        label: opt,
        value: opt
    }));
}

export function formatDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString();
}

export function formatCurrency(amount, currency = 'AED') {
    const num = Number(amount);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'AED'
    }).format(num);
}
