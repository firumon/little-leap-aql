import { ref, unref } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useResourceRelations } from 'src/composables/resources/useResourceRelations'
import { findParentCodeField } from 'src/utils/appHelpers'

export function useResourceRelationsData(resourceNameRef) {
  const dataStore = useDataStore()
  const { childResources, parentResource } = useResourceRelations(resourceNameRef)
  const childRecordsByResource = ref({})
  const parentRecord = ref(null)

  async function loadChildRecords(parentCode, parentConfig, options = { includeInactive: true }) {
    const resolvedParentCode = unref(parentCode)
    if (!resolvedParentCode) {
      childRecordsByResource.value = {}
      return {}
    }

    const nextMap = {}
    for (const child of childResources.value) {
      try {
        await dataStore.loadResource(child.name, options)
        const parentCodeField = findParentCodeField(child, parentConfig)
        nextMap[child.name] = dataStore.getRecords(child.name).filter((row) => row[parentCodeField] === resolvedParentCode)
      } catch {
        nextMap[child.name] = []
      }
    }

    childRecordsByResource.value = nextMap
    return nextMap
  }

  async function loadParentRecord(record, parentConfig, options = { includeInactive: true }) {
    if (!parentResource.value || !record) {
      parentRecord.value = null
      return null
    }

    const parentCodeField = findParentCodeField(parentConfig, parentResource.value)
    const parentCode = record[parentCodeField]
    if (!parentCode) {
      parentRecord.value = null
      return null
    }

    try {
      await dataStore.loadResource(parentResource.value.name, options)
      parentRecord.value = dataStore.getRecords(parentResource.value.name).find((row) => row.Code === parentCode) || null
    } catch {
      parentRecord.value = null
    }

    return parentRecord.value
  }

  async function loadRelations(record, parentConfig, options = { includeInactive: true }) {
    const tasks = [loadChildRecords(record?.Code, parentConfig, options)]
    if (record) {
      tasks.push(loadParentRecord(record, parentConfig, options))
    }
    await Promise.all(tasks)
    return {
      childRecordsByResource: childRecordsByResource.value,
      parentRecord: parentRecord.value
    }
  }

  return {
    childResources,
    parentResource,
    childRecordsByResource,
    parentRecord,
    loadChildRecords,
    loadParentRecord,
    loadRelations
  }
}

