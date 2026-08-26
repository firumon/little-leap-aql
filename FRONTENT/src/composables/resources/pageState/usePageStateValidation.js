import { computed } from 'vue'
import { useResourceConfig } from '../useResourceConfig'

// Required-header checks for every node, plus any `strategy.validate` override.
export function usePageStateValidation ({ state, registry, strategy = {} }) {
  const { requiredHeaders } = useResourceConfig()

  function validateRow (node, data, errors, index) {
    for (const field of requiredHeaders.value) {
      const val = data?.[field]
      if (val === undefined || val === null || val === '') {
        errors.push(index === undefined
          ? { resource: node.resource, field, message: `${field} is required` }
          : { resource: node.resource, field, message: `Row ${index + 1}: ${field} is required`, index })
      }
    }
  }

  function validateNode (node) {
    const errors = []
    try {
      if (node.many) {
        node.records.forEach((rec, idx) => {
          if (!rec || rec.status === 'Inactive') return
          validateRow(node, rec.data, errors, idx)
        })
      } else {
        validateRow(node, node.record, errors)
      }
    } catch (e) {
      console.warn('Generic validation error', e)
    }

    if (strategy.validate) errors.push(...strategy.validate(node, state))
    return errors
  }

  const validationErrors = computed(() => {
    const all = []
    registry.eachNode((node) => all.push(...validateNode(node)))
    return all
  })

  function nodeValidation (nodeRef) {
    return computed(() => validateNode(nodeRef.value))
  }

  return { validateNode, validationErrors, nodeValidation }
}
