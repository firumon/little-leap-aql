const target = typeof self !== 'undefined' ? self : globalThis

if (target && !target.__LL_IDB_COMPAT_APPLIED__) {
  target.__LL_IDB_COMPAT_APPLIED__ = true

  if (!target.IDBOperation && target.IDBTransaction) {
    target.IDBOperation = target.IDBTransaction
  }

  if (target.IDBDatabase?.prototype) {
    const dbProto = target.IDBDatabase.prototype
    if (!dbProto.operation && typeof dbProto.transaction === 'function') {
      dbProto.operation = dbProto.transaction
    }
  }

  if (target.IDBOpenDBRequest?.prototype) {
    const reqProto = target.IDBOpenDBRequest.prototype
    if (!Object.getOwnPropertyDescriptor(reqProto, 'operation')) {
      Object.defineProperty(reqProto, 'operation', {
        configurable: true,
        enumerable: false,
        get() {
          return this.transaction
        }
      })
    }
  }
}
