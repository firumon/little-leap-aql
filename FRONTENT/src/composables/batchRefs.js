export function batchRef(path) { return { $ref: path } }
export function isBatchRef(value) { return !!(value && typeof value === 'object' && value.$ref) }
export function textOrRef(value) { return isBatchRef(value) ? value : String(value || '').trim() }

