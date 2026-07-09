import { computed, inject } from 'vue'
import { useSectionResolver } from './useSectionResolver'

/**
 * Encapsulates the common logic of section resolver, context injections,
 * prop modifier merging, and function prop evaluation for layout section components.
 */
export function useCommonSection({ sectionName, page, preparedProps = {}, evaluateKeys = [] }) {
  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)
  // Construct a single reactive object containing all context information

  // required by useSectionResolver to match the expected computed ref signature.
  const resolverProps = computed(() => {
    const baseProps = typeof preparedProps === 'function'
      ? preparedProps()
      : (preparedProps.value || preparedProps)

    return {
      section: sectionName,
      page: page,
      scope: resourceConfig?.scope?.value ?? 'master',
      resource: resourceConfig?.resourceSlug?.value ?? '',
      uiName: resourceConfig?.customUIName?.value ?? 'AQL',
      ...baseProps
    }
  })

  const { ready, resolvedComponent, finalProps: resolvedFinalProps } = useSectionResolver(resolverProps)

  // Helper function to evaluate dynamic config/modifier values
  function evaluate(val) {
    if (typeof val === 'function') {
      return val(resourceRecord, resourceConfig)
    }
    return val
  }

  // Post-process the resolved final props to handle function evaluations (e.g. evaluateKeys)
  const finalProps = computed(() => {
    const rawProps = resolvedFinalProps.value || {}
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
    sectionsReady: ready,
    resourceConfig,
    resourceRecord,
    evaluate,
    finalProps
  }
}
