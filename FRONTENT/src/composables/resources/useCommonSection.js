import {computed, inject} from 'vue'
import {useSectionResolver} from './useSectionResolver'

/**
 * Encapsulates the common logic of section resolver, context injections,
 * prop modifier merging, and function prop evaluation for layout section components.
 */
export function useCommonSection({ sectionName, page, preparedProps = {}, evaluateKeys = [] }) {
  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)

  const { resolvedComponent, propModifier, sectionsReady } = useSectionResolver({
    sectionName,
    page
  })

  // Help function to evaluate dynamic config/modifier values
  function evaluate(val) {
    if (typeof val === 'function') {
      return val(resourceRecord, resourceConfig)
    }
    return val
  }

  const finalProps = computed(() => {
    const baseProps = typeof preparedProps === 'function'
      ? preparedProps()
      : (preparedProps.value || preparedProps)

    const rawProps = propModifier.value(baseProps)
    const evaluated = {}
    for (const key of Object.keys(rawProps)) {
      const val = rawProps[key]
      if (typeof val === 'function' && evaluateKeys.includes(key)) {
        evaluated[key] = evaluate(val)
      } else if (key === 'back' && typeof val === 'function') {
        evaluated[key] = true
      } else {
        evaluated[key] = val
      }
    }
    return evaluated
  })

  return {
    resolvedComponent,
    propModifier,
    sectionsReady,
    resourceConfig,
    resourceRecord,
    evaluate,
    finalProps
  }
}
