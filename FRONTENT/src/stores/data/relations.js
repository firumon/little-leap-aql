import { pluralize, singularize } from 'src/utils/appHelpers'

const DEFAULT_TARGET_HEADER = 'Code'

// `APP.Resources.Relations` accepts a shorthand string ("SKUs") or an extended
// object ({ resource, targetHeader?, labelHeader? }). Both collapse to the same
// internal shape here.
function _normalizeRelationSpec(spec) {
  if (typeof spec === 'string') {
    const resource = spec.trim()
    return resource ? { resource, targetHeader: DEFAULT_TARGET_HEADER, labelHeader: '' } : null
  }
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    const resource = (spec.resource || '').toString().trim()
    if (!resource) return null
    return {
      resource,
      targetHeader: (spec.targetHeader || '').toString().trim() || DEFAULT_TARGET_HEADER,
      labelHeader: (spec.labelHeader || '').toString().trim()
    }
  }
  return null
}

export function createRelations(state) {
  const { resourceRelations } = state

  // Step 1 (normalization): consolidate baseline heuristics and explicit
  // `APP.Resources.Relations` metadata into one `{ [header]: { resource,
  // targetHeader, labelHeader } }` map per resource. Explicit entries win.
  function _buildEffectiveRelations(resource, resourceNames) {
    const effective = {}
    const resourceHeaders = resource.headers || []

    const parentStr = (resource.parentResource || '').toString().trim()
    if (parentStr && resourceNames.includes(parentStr)) {
      const expectedHdr = resourceHeaders.find(h => h.endsWith('Code') && h !== 'Code' && pluralize(h.slice(0, -4)) === parentStr)
        || singularize(parentStr) + 'Code'
      effective[expectedHdr] = { resource: parentStr, targetHeader: DEFAULT_TARGET_HEADER, labelHeader: '' }
    }

    for (const header of resourceHeaders) {
      if (header === 'Code' || !header.endsWith('Code')) continue
      const plural = pluralize(header.slice(0, -4))
      if (resourceNames.includes(plural)) {
        effective[header] = { resource: plural, targetHeader: DEFAULT_TARGET_HEADER, labelHeader: '' }
      } else if (plural === 'Parents') {
        effective[header] = { resource: resource.name, targetHeader: DEFAULT_TARGET_HEADER, labelHeader: '' }
      }
    }

    const explicit = resource.relations && typeof resource.relations === 'object' ? resource.relations : {}
    for (const [header, spec] of Object.entries(explicit)) {
      const normalized = _normalizeRelationSpec(spec)
      if (normalized && resourceNames.includes(normalized.resource)) {
        effective[header] = normalized
      }
    }

    return effective
  }

  function _deriveAllRelations(resources) {
    Object.keys(resourceRelations).forEach(k => delete resourceRelations[k])

    const resourceNames = resources.map(r => r.name)

    // Step 1 — normalization
    const effectiveRelations = {}
    resources.forEach(r => {
      effectiveRelations[r.name] = _buildEffectiveRelations(r, resourceNames)
    })

    // Step 2 — topology graph, derived exclusively from the normalized map
    const resourceParents = {}, resourceChildren = {}, linkRefs = {}, refs = {}
    resources.forEach(r => {
      const parents = []
      const seenParents = new Set()
      linkRefs[r.name] = {}
      refs[r.name] = {}

      for (const [header, rel] of Object.entries(effectiveRelations[r.name])) {
        linkRefs[r.name][header] = rel.resource
        refs[r.name][header] = { header, ...rel }

        if (!seenParents.has(rel.resource)) {
          seenParents.add(rel.resource)
          parents.push({
            resourceName: rel.resource,
            codeField: header,
            targetHeader: rel.targetHeader,
            labelHeader: rel.labelHeader,
            singular: singularize(rel.resource),
            scope: r.scope
          })
        }

        if (!Object.hasOwn(resourceChildren, rel.resource)) resourceChildren[rel.resource] = []
        if (!resourceChildren[rel.resource].some(c => c.name === r.name)) {
          resourceChildren[rel.resource].push({
            name: r.name,
            codeField: header,
            targetHeader: rel.targetHeader,
            labelHeader: rel.labelHeader,
            singular: singularize(r.name),
            scope: r.scope
          })
        }
      }

      resourceParents[r.name] = parents
    })

    resources.forEach(res => {
      resourceRelations[res.name] = {
        parents: resourceParents[res.name] || [],
        children: resourceChildren[res.name] || [],
        linkRefs: linkRefs[res.name] || {},
        refs: refs[res.name] || {}
      }
    })
  }

  function getRelations(resourceName) {
    return resourceRelations[resourceName] || { parents: [], children: [], linkRefs: {}, refs: {} }
  }

  return {
    _deriveAllRelations,
    getRelations
  }
}
