import { openDB } from 'idb';

const DB_NAME = 'little-leap-aql-db';
const DB_VERSION = 2;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        // Store for API responses used as a local cache
        if (!db.objectStoreNames.contains('api-cache')) {
            db.createObjectStore('api-cache', { keyPath: 'url' });
        }

        // Store for pending mutations (POST/PUT/DELETE) that need to be synced
        if (!db.objectStoreNames.contains('sync-queue')) {
            db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
        }

        // Generic store for application state/data
        if (!db.objectStoreNames.contains('app-data')) {
            db.createObjectStore('app-data');
        }

        // Per-resource metadata such as headers and sync cursor
        if (!db.objectStoreNames.contains('resource-meta')) {
            db.createObjectStore('resource-meta', { keyPath: 'resource' });
        }

        // Per-resource row cache keyed by resource + business code
        if (!db.objectStoreNames.contains('resource-records')) {
            const store = db.createObjectStore('resource-records', { keyPath: 'id' });
            store.createIndex('by-resource', 'resource', { unique: false });
            store.createIndex('by-resource-updatedAt', ['resource', 'updatedAt'], { unique: false });
        }
    },
});

export async function getCache(url) {
    return (await dbPromise).get('api-cache', url);
}

export async function setCache(url, data) {
    return (await dbPromise).put('api-cache', {
        url,
        data,
        timestamp: Date.now()
    });
}

export async function addToSyncQueue(requestData) {
    return (await dbPromise).add('sync-queue', {
        ...requestData,
        timestamp: Date.now()
    });
}

export async function getSyncQueue() {
    return (await dbPromise).getAll('sync-queue');
}

export async function removeFromSyncQueue(id) {
    return (await dbPromise).delete('sync-queue', id);
}

export async function setResourceMeta(resource, meta = {}) {
    if (!resource) return null;
    const db = await dbPromise;
    const current = await db.get('resource-meta', resource);
    return db.put('resource-meta', {
        ...(current || {}),
        resource,
        ...meta
    });
}

export async function getResourceMeta(resource) {
    if (!resource) return null;
    return (await dbPromise).get('resource-meta', resource);
}

export async function setAuthorizedResources(resources = []) {
    const db = await dbPromise;
    const tx = db.operation('resource-meta', 'readwrite');
    for (const resource of resources) {
        const name = (resource?.name || '').toString().trim();
        if (!name) continue;

        const existing = await tx.store.get(name);
        await tx.store.put({
            resource: name,
            headers: Array.isArray(resource.headers) ? resource.headers : (existing?.headers || []),
            permissions: resource.permissions || existing?.permissions || null,
            fileId: resource.fileId || existing?.fileId || '',
            sheetName: resource.sheetName || existing?.sheetName || '',
            codePrefix: resource.codePrefix || existing?.codePrefix || '',
            codeSequenceLength: resource.codeSequenceLength || existing?.codeSequenceLength || null,
            lastSyncAt: existing?.lastSyncAt || null
        });
    }
    await tx.done;
}

function normalizeKeyValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function parseDateForSort(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

export async function upsertResourceRows(resource, headers = [], rows = []) {
    if (!resource || !Array.isArray(headers) || !Array.isArray(rows) || headers.length === 0) {
        return 0;
    }

    const codeIndex = headers.indexOf('Code');
    if (codeIndex === -1) return 0;

    const updatedAtIndex = headers.indexOf('UpdatedAt');
    const db = await dbPromise;
    const tx = db.operation('resource-records', 'readwrite');
    let affected = 0;

    for (const row of rows) {
        if (!Array.isArray(row)) continue;

        const code = normalizeKeyValue(row[codeIndex]);
        if (!code) continue;

        const updatedAtRaw = updatedAtIndex === -1 ? null : row[updatedAtIndex];
        await tx.store.put({
            id: `${resource}::${code}`,
            resource,
            code,
            row,
            updatedAt: parseDateForSort(updatedAtRaw),
            storedAt: Date.now()
        });
        affected += 1;
    }

    await tx.done;
    return affected;
}

export async function getResourceRows(resource, options = {}) {
    if (!resource) return [];
    const { includeInactive = true, statusIndex = -1 } = options;
    const db = await dbPromise;
    const tx = db.operation('resource-records', 'readonly');
    const index = tx.store.index('by-resource');
    const allRows = await index.getAll(resource);
    await tx.done;

    const filtered = allRows.filter((entry) => Array.isArray(entry.row)).map((entry) => entry.row);
    if (includeInactive || statusIndex === -1) {
        return filtered;
    }

    return filtered.filter((row) => (row[statusIndex] || '').toString().trim() === 'Active');
}

async function deleteIndexedDbByName(databaseName) {
    if (!databaseName || typeof indexedDB === 'undefined') return false;
    return new Promise((resolve) => {
        try {
            const request = indexedDB.deleteDatabase(databaseName);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
            request.onblocked = () => resolve(false);
        } catch (error) {
            resolve(false);
        }
    });
}

export async function clearAllClientStorage() {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        const db = await dbPromise;
        db.close();
    } catch (error) {
        // no-op
    }

    const databaseNames = [];
    if (typeof indexedDB !== 'undefined') {
        if (typeof indexedDB.databases === 'function') {
            try {
                const databases = await indexedDB.databases();
                (databases || []).forEach((entry) => {
                    const name = (entry?.name || '').toString().trim();
                    if (name) {
                        databaseNames.push(name);
                    }
                });
            } catch (error) {
                // no-op
            }
        }

        if (!databaseNames.length) {
            databaseNames.push(DB_NAME);
        }

        const seen = {};
        for (const name of databaseNames) {
            const key = name.toLowerCase();
            if (seen[key]) continue;
            seen[key] = true;
            await deleteIndexedDbByName(name);
        }
    }

    try {
        localStorage.clear();
    } catch (error) {
        // no-op
    }
}
