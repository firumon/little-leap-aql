import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'

// Pure Currency enrichment function
export const enrichCurrency = (curr) => {
  if (!curr || !curr.Code) return null
  const isBase = String(curr.BaseCurrency).toUpperCase() === 'TRUE' || curr.BaseCurrency === true
  const decimals = curr.Decimals !== undefined && curr.Decimals !== '' ? Number(curr.Decimals) : 2
  const roundingInterval = Number(curr.RoundingInterval) || (1 / Math.pow(10, decimals))
  const conversionFactor = Number(curr.ConversionFactor) || 1

  return {
    code: curr.Code,
    currencyCode: curr.Code,
    name: curr.Name || '',
    symbol: curr.Symbol || curr.Code,
    subunit: curr.Subunit || '',
    decimals,
    roundingInterval,
    baseCurrency: isBase,
    isBaseCurrency: isBase,
    conversionFactor,
    accessRegion: curr.AccessRegion || '',
    status: curr.Status || 'Active',
    createdAt: curr.CreatedAt || '',
    updatedAt: curr.UpdatedAt || '',
    createdBy: curr.CreatedBy || '',
    updatedBy: curr.UpdatedBy || '',
    _raw: curr
  }
}

// Composable for Currency master resource — Single Source of Truth
export function useCurrencyResource() {
  const authStore = useAuthStore()
  const dataStore = useDataStore()

  // Dynamic default currency code from App Config
  const defaultCurrencyCode = computed(() => {
    const config = authStore.appConfigMap || {}
    const rawVal = config.Currency ?? config.currency
    if (rawVal) return String(rawVal).trim()
    return 'AED'
  })

  // Reactive enriched currencies
  const currencies = computed(() => {
    const raw = dataStore.getRecords('Currencies') || []
    return raw.map(enrichCurrency).filter(Boolean)
  })

  const activeCurrencies = computed(() => currencies.value.filter((c) => c.status === 'Active'))

  const currencyMap = computed(() => new Map(currencies.value.map((c) => [c.code.toUpperCase(), c])))

  const baseCurrency = computed(() => {
    return activeCurrencies.value.find((c) => c.isBaseCurrency) || activeCurrencies.value[0] || null
  })

  const defaultCurrency = computed(() => {
    const code = defaultCurrencyCode.value.toUpperCase()
    const found = currencyMap.value.get(code)
    if (found) return found

    return {
      code: defaultCurrencyCode.value,
      currencyCode: defaultCurrencyCode.value,
      name: defaultCurrencyCode.value,
      symbol: defaultCurrencyCode.value,
      subunit: '',
      decimals: 2,
      roundingInterval: 0.01,
      baseCurrency: false,
      isBaseCurrency: false,
      conversionFactor: 1,
      status: 'Active'
    }
  })

  const loading = computed(() => !!dataStore.loadingByResource?.Currencies)

  const getCurrency = (code) => {
    if (!code) return null
    return currencyMap.value.get(String(code).trim().toUpperCase()) || null
  }

  // Rounding helpers
  const roundToDecimals = (value, currencyCode) => {
    const cur = getCurrency(currencyCode || defaultCurrencyCode.value)
    const decimals = cur?.decimals !== undefined ? cur.decimals : 2
    const val = Number(value) || 0
    return parseFloat(val.toFixed(decimals))
  }

  const roundToInterval = (value, currencyCode) => {
    const cur = getCurrency(currencyCode || defaultCurrencyCode.value)
    const decimals = cur?.decimals !== undefined ? cur.decimals : 2
    let interval = cur?.roundingInterval
    if (!interval || interval <= 0) {
      interval = 1 / Math.pow(10, decimals)
    }
    const val = Number(value) || 0
    const rounded = Math.round(val / interval) * interval
    return parseFloat(rounded.toFixed(decimals + 2))
  }

  // Currency conversion
  const convertCurrency = (amount, fromCode, toCode) => {
    const from = String(fromCode || defaultCurrencyCode.value).trim().toUpperCase()
    const to = String(toCode || defaultCurrencyCode.value).trim().toUpperCase()
    const val = Number(amount) || 0
    if (from === to) return val

    const fromCur = getCurrency(from)
    const toCur = getCurrency(to)

    const fromFactor = fromCur?.conversionFactor ?? 1
    const toFactor = toCur?.conversionFactor ?? 1

    return (val * fromFactor) / toFactor
  }

  // Format currency with symbol
  const formatCurrency = (amount, currencyCode) => {
    const code = String(currencyCode || defaultCurrencyCode.value).trim()
    const cur = getCurrency(code)
    const symbol = cur?.symbol || code
    const decimals = cur?.decimals !== undefined ? cur.decimals : 2
    const roundedValue = roundToDecimals(amount, code)

    return `${symbol} ${Number(roundedValue).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}`
  }

  // Compact polyvalent currency formatting helper: _C(value, showSymbol?, targetCode?, sourceCode?)
  const _C = (value, showSymbolOrCode, targetCode, sourceCode) => {
    let showSymbol = false
    let code = defaultCurrencyCode.value

    if (typeof showSymbolOrCode === 'boolean') {
      showSymbol = showSymbolOrCode
      if (targetCode) code = String(targetCode).trim()
    } else if (typeof showSymbolOrCode === 'string') {
      code = String(showSymbolOrCode).trim()
    }

    const src = sourceCode ? String(sourceCode).trim() : defaultCurrencyCode.value
    const convertedValue = convertCurrency(value, src, code)
    const roundedValue = roundToDecimals(convertedValue, code)

    const cur = getCurrency(code)
    const symbol = cur?.symbol || code
    const decimals = cur?.decimals !== undefined ? cur.decimals : 2

    const formatted = Number(roundedValue).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })

    if (showSymbol) {
      const spacer = symbol.length > 2 ? ' ' : ''
      return `${symbol}${spacer}${formatted}`
    }
    return formatted
  }

  return {
    defaultCurrencyCode,
    currencies,
    allCurrencies: currencies,
    activeCurrencies,
    baseCurrency,
    defaultCurrency,
    loading,
    currencyMap,
    getCurrency,
    roundToDecimals,
    roundToInterval,
    convertCurrency,
    formatCurrency,
    _C
  }
}
