import { defineStore } from 'pinia'
import {
  authorizedResourcesSet,
  dbInitialize,
  draftDelete,
  draftGet,
  draftSave,
  metaGet,
  metaSet,
  rowsGet,
  rowsUpsert,
  storagesClear
} from 'src/services/IndexedDbCacheService'

export const useClientCacheStore = defineStore('clientCache', () => {
  async function initializeDb() {
    return dbInitialize()
  }

  async function setAuthorizedResources(resources = [], resetCursors = false) {
    return authorizedResourcesSet(resources, resetCursors)
  }

  async function clearAllStorage() {
    return storagesClear()
  }

  async function getResourceMeta(resource) {
    return metaGet(resource)
  }

  async function setResourceMeta(resource, meta) {
    return metaSet(resource, meta)
  }

  async function getResourceRows(resource, options = {}) {
    return rowsGet(resource, options)
  }

  async function upsertResourceRows(resource, headers = [], rows = []) {
    return rowsUpsert(resource, headers, rows)
  }

  async function getDraft(key) {
    return draftGet(key)
  }

  async function saveDraft(key, data) {
    return draftSave(key, data)
  }

  async function deleteDraft(key) {
    return draftDelete(key)
  }

  return {
    initializeDb,
    setAuthorizedResources,
    clearAllStorage,
    getResourceMeta,
    setResourceMeta,
    getResourceRows,
    upsertResourceRows,
    getDraft,
    saveDraft,
    deleteDraft
  }
})

