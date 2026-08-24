#!/usr/bin/env node
// Enforces the "Code Comments — Keep Them Rare" rule in CLAUDE.md.
// Reads a PostToolUse payload on stdin, looks at the lines this edit ADDED to the file
// (a brand new file counts as all-added), and warns when a run of added comment lines is
// longer than MAX_LINES.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, basename } from 'node:path'

const MAX_LINES = 3
const CHECKED = /\.(js|mjs|cjs|ts|vue|gs)$/i
const COMMENT = /^\s*(\/\/|\/\*|\*|<!--|-->)/

const read = async () => {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  try { return JSON.parse(raw) } catch { return null }
}

const git = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore']
})

const payload = await read()
const file = payload?.tool_input?.file_path || payload?.tool_response?.filePath
if (!file || !CHECKED.test(file)) process.exit(0)

const dir = dirname(file)

// Added lines only. An untracked file has no diff against HEAD, so every line is new.
let added = []
try {
  try {
    git(['ls-files', '--error-unmatch', '--', file], dir)
    added = git(['diff', 'HEAD', '-U0', '--', file], dir)
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
  } catch {
    added = readFileSync(file, 'utf8').split('\n')
  }
} catch {
  process.exit(0)
}

let run = 0
let longest = 0
for (const line of added) {
  if (COMMENT.test(line)) {
    run += 1
    if (run > longest) longest = run
  } else {
    run = 0
  }
}

if (longest <= MAX_LINES) process.exit(0)

process.stdout.write(JSON.stringify({
  systemMessage: `CLAUDE.md: ${basename(file)} has a ${longest}-line comment block — keep comments to 1-2 lines.`,
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext:
      `CLAUDE.md "Code Comments — Keep Them Rare" is being violated in ${file}: ` +
      `this edit left a ${longest}-line comment block. Cut it to 1-2 lines of simple, ` +
      `easy English, or delete it — do that now, before moving on to anything else.`
  }
}))
