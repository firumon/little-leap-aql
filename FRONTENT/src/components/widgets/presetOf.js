const presetModules = import.meta.glob('./*.js', { eager: true })

const presets = {}
for (const [path, mod] of Object.entries(presetModules)) {
  const match = path.match(/\.\/(\w+)\.js$/)
  if (match && match[1] !== 'presetOf') {
    presets[match[1]] = mod.default || mod
  }
}

export function presetOf(name) {
  if (!name) return null
  return presets[name] || null
}

export { presets }
