export function getHeaderIndexMap(headers = []) {
  const map = {}
  headers.forEach((header, index) => {
    map[header] = index
  })
  return map
}

export function mapObjectsToRows(records = [], headers = []) {
  return records.map((record) => headers.map((header) => record?.[header]))
}

export function mapRowsToObjects(rows = [], headers = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return []
  }

  if (!Array.isArray(rows[0])) {
    return rows.map((entry) => ({ ...entry }))
  }

  const idx = getHeaderIndexMap(headers)
  return rows.map((row) => {
    const obj = {}
    headers.forEach((header) => {
      obj[header] = row[idx[header]]
    })
    return obj
  })
}

export function normalizeCursorValue(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const timestamp = Number(value)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp
  }

  const parsedTime = new Date(value).getTime()
  return Number.isFinite(parsedTime) ? parsedTime : null
}

export function resolveSyncRows(responseData, headers) {
  if (Array.isArray(responseData?.rows)) {
    return responseData.rows
  }

  if (Array.isArray(responseData?.records)) {
    return mapObjectsToRows(responseData.records, headers)
  }

  if (Array.isArray(responseData?.data)) {
    return Array.isArray(responseData.data[0])
      ? responseData.data
      : mapObjectsToRows(responseData.data, headers)
  }

  return []
}
