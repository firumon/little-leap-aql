import { defineStore } from 'pinia'
import { createState } from './data/state'
import { createProjections } from './data/projections'
import { createRelations } from './data/relations'
import { createSync } from './data/sync'

export const useDataStore = defineStore('data', () => {
  const state = createState()
  const projections = createProjections(state)
  const relations = createRelations(state)
  const sync = createSync(state, projections, relations)

  return {
    headers: state.headers,
    rows: state.rows,
    loadingByResource: state.loadingByResource,
    backgroundSyncingByResource: state.backgroundSyncingByResource,
    resourceRelations: state.resourceRelations,
    ensureResourceState: state.ensureResourceState,
    initResource: state.initResource,
    setRows: state.setRows,
    replaceRows: state.replaceRows,
    getRows: projections.getRows,
    getRowCount: state.getRowCount,
    hasRows: state.hasRows,
    beginCacheReset: sync.beginCacheReset,
    endCacheReset: sync.endCacheReset,
    resetSeedState: sync.resetSeedState,
    getRecords: projections.getRecords,
    getRecordsBy: projections.getRecordsBy,
    getRecordBy: projections.getRecordBy,
    getRecord: projections.getRecord,
    remember: projections.remember,
    getRelations: relations.getRelations,
    seedResourceFromCache: sync.seedResourceFromCache,
    seedAuthorizedResources: sync.seedAuthorizedResources,
    loadResource: sync.loadResource,
    syncResource: sync.syncResource,
    updateRowsFromSync: sync.updateRowsFromSync,
    cacheResourceRows: sync.cacheResourceRows,
    setResourceMetadata: sync.setResourceMetadata
  }
})
