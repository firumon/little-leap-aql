// Checks every named import of a `src/...` module against that module's exports.
// Catches renames missed during a refactor, which a syntax check cannot see.
import { readFileSync, existsSync, statSync, globSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'

const ROOT = resolve(process.argv[2] || 'FRONTENT')
const SRC = join(ROOT, 'src')

const files = globSync('**/*.{js,vue}', { cwd: SRC }).map((f) => join(SRC, f))

const exportsOf = new Map()
function readExports (file) {
  if (exportsOf.has(file)) return exportsOf.get(file)
  const names = new Set()
  if (existsSync(file)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.add(m[1])
    for (const m of src.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1])
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim()
        if (name) names.add(name)
      }
    }
    if (/export\s+\*\s+from/.test(src)) names.add('*')
  }
  exportsOf.set(file, names)
  return names
}

function resolveSpec (spec, from) {
  let base
  if (spec.startsWith('src/')) base = join(SRC, spec.slice(4))
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(from), spec)
  else return null
  for (const cand of [base, base + '.js', join(base, 'index.js'), base + '.vue']) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

let problems = 0
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveSpec(m[2], file)
    if (!target) continue
    const available = readExports(target)
    if (available.has('*')) continue
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim()
      if (!name || name === 'type') continue
      if (!available.has(name)) {
        problems++
        console.log(`${file.slice(ROOT.length + 1)}: imports "${name}" from ${m[2]} — not exported`)
      }
    }
  }
}
console.log(problems ? `${problems} broken import(s)` : 'all named imports resolve')
