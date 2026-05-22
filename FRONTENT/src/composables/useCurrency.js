import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useResourceIoStore } from 'src/stores/resourceIo'

/**
 * Global composable to manage dynamic app-wide currencies, formats, and conversions.
 */
export function useCurrency() {
  const authStore = useAuthStore()
  const dataStore = useDataStore()
  const resourceIoStore = useResourceIoStore()

  // Dynamic default currency code lookup from Config sheet (case-insensitive)
  const defaultCurrencyCode = computed(() => {
    const config = authStore.appConfigMap || {}
    const rawVal = config.Currency ?? config.currency
    if (rawVal) return String(rawVal).trim()
    return 'AED'
  })

  // Dynamic list of Currencies master records
  const currencies = computed(() => {
    return dataStore.getRecords('Currencies') || []
  })

  // Dynamic record matching defaultCurrencyCode
  const defaultCurrency = computed(() => {
    const code = defaultCurrencyCode.value
    const found = currencies.value.find(c => String(c.Code).trim().toUpperCase() === code.toUpperCase())
    if (found) return found
    
    // Graceful default fallback
    return {
      Code: code,
      Symbol: code,
      Decimals: 2,
      ConversionFactor: 1
    }
  })

  // Programmatically track fetching status
  const loading = computed(() => {
    return !!dataStore.loadingByResource.Currencies
  })

  // Format currency dynamically based on Code definitions
  function formatCurrency(amount, currencyCode) {
    const code = String(currencyCode || defaultCurrencyCode.value).trim()
    const cur = currencies.value.find(c => String(c.Code).trim().toUpperCase() === code.toUpperCase())
    
    const symbol = cur?.Symbol || code
    const decimals = cur && cur.Decimals !== undefined ? Number(cur.Decimals) : 2
    const val = Number(amount) || 0

    return `${symbol} ${val.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}`
  }

  // Converts amount from one currency to another using their conversion factors relative to the base currency
  function convertCurrency(amount, fromCode, toCode) {
    const from = String(fromCode || defaultCurrencyCode.value).trim().toUpperCase()
    const to = String(toCode || defaultCurrencyCode.value).trim().toUpperCase()
    if (from === to) return Number(amount) || 0

    const curList = currencies.value
    const fromCur = curList.find(c => String(c.Code).trim().toUpperCase() === from)
    const toCur = curList.find(c => String(c.Code).trim().toUpperCase() === to)

    const fromFactor = fromCur && fromCur.ConversionFactor !== undefined ? Number(fromCur.ConversionFactor) : 1
    const toFactor = toCur && toCur.ConversionFactor !== undefined ? Number(toCur.ConversionFactor) : 1

    const val = Number(amount) || 0
    // Conversion Formula: (amount * fromFactor) / toFactor
    return (val * fromFactor) / toFactor
  }

  // Compact polyvalent currency helper _C
  function _C(value, showSymbolOrCode, targetCode, sourceCode) {
    let showSymbol = false
    let code = defaultCurrencyCode.value

    if (typeof showSymbolOrCode === 'boolean') {
      showSymbol = showSymbolOrCode
      if (targetCode) {
        code = String(targetCode).trim()
      }
    } else if (typeof showSymbolOrCode === 'string') {
      code = String(showSymbolOrCode).trim()
    }

    // Determine the source currency
    const src = sourceCode ? String(sourceCode).trim() : defaultCurrencyCode.value

    // Perform conversion only if source differs from target
    const convertedValue = convertCurrency(value, src, code)

    // Format output
    const cur = currencies.value.find(c => String(c.Code).trim().toUpperCase() === code.toUpperCase())
    const symbol = cur?.Symbol || code
    const decimals = cur && cur.Decimals !== undefined ? Number(cur.Decimals) : 2

    const formatted = Number(convertedValue).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })

    if (showSymbol) {
      // Put a space if the symbol is 3 chars long (e.g. AED) to match user preference
      const spacer = symbol.length > 2 ? ' ' : ''
      return `${symbol}${spacer}${formatted}`
    }
    return formatted
  }

  return {
    defaultCurrencyCode,
    currencies,
    defaultCurrency,
    loading,
    formatCurrency,
    convertCurrency,
    _C
  }
}
