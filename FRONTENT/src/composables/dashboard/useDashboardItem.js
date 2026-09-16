import { toPascalCase } from 'src/utils/appHelpers'

const customUiModules = import.meta.glob('../../_ui/**/*.js')

const customUiRegistry = {}
Object.keys(customUiModules).forEach((rawPath) => {
  const key = rawPath.replace(/^\.\.\/\.\.\//, '').toLowerCase()
  customUiRegistry[key] = customUiModules[rawPath]
})

export async function resolveDashboardItem ({ descriptor, name, scope, resource, uiName }) {
  if (!descriptor) return null

  const targetUi = (uiName || 'AQL').toLowerCase()
  const nameKey = (name || descriptor.name || '').toLowerCase()
  const scopeKey = (scope || '').toLowerCase()
  const resourceKey = toPascalCase(resource || '').toLowerCase()

  const candidates = [
    `_ui/${targetUi}/components/${scopeKey}/${resourceKey}/dashboard/${nameKey}.js`,
    `_ui/${targetUi}/components/${scopeKey}/${resourceKey}/${nameKey}.js`,
    `_ui/${targetUi}/components/${scopeKey}/dashboard/${nameKey}.js`
  ]

  let tenantPartial = null
  for (const path of candidates) {
    const loader = customUiRegistry[path]
    if (!loader) continue
    try {
      const mod = await loader()
      tenantPartial = mod?.default ?? mod
      if (tenantPartial) break
    } catch (err) {
      tenantPartial = null
      break
    }
  }

  if (!tenantPartial || typeof tenantPartial !== 'object') {
    return descriptor
  }

  const { compute: tenantCompute, ...restTenant } = tenantPartial
  const baseCompute = typeof descriptor.compute === 'function'
    ? descriptor.compute.bind(descriptor)
    : () => null

  const merged = {
    ...descriptor,
    ...restTenant
  }

  if (typeof tenantCompute === 'function') {
    merged.compute = (ctx) => tenantCompute(ctx, baseCompute)
  }

  return merged
}

