import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

/**
 * @deprecated Deprecated in favor of useCurrencyResource.
 * Will be removed in upcoming refactors. Please import useCurrencyResource directly from
 * 'src/_resource/Master/Currencies/composables/useCurrencyResource'.
 */
export function useCurrency() {
  return useCurrencyResource()
}
