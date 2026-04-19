import { executeGasApi } from 'src/services/GasApiService'

export async function generateReport(payload = {}) {
  return executeGasApi('generateReport', payload)
}
