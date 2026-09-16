import { useRecord } from 'src/composables/resources/useRecord'

const RESOURCE_NAME = 'Procurements'

const text = (value) => String(value ?? '').trim()

export { RESOURCE_NAME }

export function useProcurementResource () {
  const record = useRecord()

  const getProcurement = (code) => {
    const key = text(code)
    if (!key) return null
    return record.recordBy(RESOURCE_NAME, 'Code', key)
  }

  return {
    procurements: () => record.enriched(RESOURCE_NAME),
    getProcurement
  }
}
