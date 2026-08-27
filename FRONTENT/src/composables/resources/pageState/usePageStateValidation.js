import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { findResourceConfig } from '../useResourceConfig'

// Required-header checks for every node, plus any `strategy.validate` override.
export function usePageStateValidation ({ state, registry, strategy = {} }) {
  const auth = useAuthStore()

  // Per NODE, not per page. A batch writes several resources, and holding a
  // StockMovements row to OutletRestocks' required headers fails it for a column
  // its sheet does not have.
  function requiredHeadersFor (resource) {
    const raw = findResourceConfig(auth, resource)?.requiredHeaders || ''
    return raw ? raw.split(',').map((h) => h.trim()).filter(Boolean) : []
  }

  function validateRow (node, data, errors, index) {
    for (const field of requiredHeadersFor(node.resource)) {
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
    // A node that builds no request is not a form the user can fix, so its
    // required headers are not missing — they are not asked for.
    const ships = node.many || node.children.length > 0 || Object.keys(node.record).length > 0
    try {
      if (node.many) {
        node.records.forEach((rec, idx) => {
          if (!rec || rec.status === 'Inactive') return
          validateRow(node, rec.data, errors, idx)
        })
      } else if (ships) {
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
