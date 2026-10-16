# Initialization: Code Cleanup Investigation

> **The job**: Read the given code. Find everything that can go. Report each one with its **cause** and its **remedy**. Then stop.
>
> **Not the job**: Do not edit anything yet. Do not add features. Do not check architecture rules, layer rules, naming, or folder rules. If code is ugly but it works and nothing is repeated or unused, leave it alone.

---

## 1. The Aim

Old code fills up with copies, dead ends, and noise nobody reads or runs.

Find all of it. Be bold. A file that grew for months is usually holding a lot it does not need. If your list comes back short and shy, you did not look hard enough. Go read the bodies again.

Every fix you propose must keep the behaviour exactly the same.

---

## 2. Scope

* The prompt names the files, or names a module (like "Outlet Restocks").
* If it names a module, search `FRONTENT/src` for the name and its short forms, in file paths and in file contents. The same feature often sits in several trees at once: `_resource/`, `_ui/AQL/`, `composables/`, `components/`, `pages/`, `dashboard/`.
* List the files you found, with line counts, at the top of your report. The user can trim it.
* If nothing is named at all, ask first.

---

## 3. What to Look For

Read every file in full. Read the bodies, not the names. There is no linter and no tests here, so nothing finds these for you.

Work in this order. The top items delete the most.

### Whole things
1. **Two stacks for one feature.** An old tree and a new tree both hold the same screens or the same builders. Follow the routes and registries down: whatever they cannot reach is dead. This is usually the biggest find. Look here first.
2. **Dead files.** No other file imports it.
3. **Dead exports and functions.** Nothing calls or reads it.
4. **Dead branches.** An `if` that can never be true. A flag nothing sets. An unreachable `default`.
5. **Commented-out code.** Git already keeps it.
6. **Unused options and parameters.** No caller ever passes them, yet the code handles both paths. Deleting the option also deletes the path it guarded.

### Repeats
7. **The same logic twice in one file.** Often a light version and a full version sharing most of their body.
8. **The same logic in two files.** Line up files that sound alike — two payload builders, an old composable and a new one. Also check sibling resources under the same domain.
9. **Twin helpers.** Several small functions doing the same check on different fields. Replace with one that takes the key.
10. **Repeated markup.** The same `.vue` block pasted with only a label changed. Use `v-for`.
11. **Helpers the repo already has.** Something already in `FRONTENT/src/utils/` (see [SHARED_UTILITIES_INDEX.md](file:///f:/AQL/Documents/SHARED_UTILITIES_INDEX.md)), or a constant list another module already owns and exports.

### Noise
12. **Comment bloat.** JSDoc, file-header blocks, banners, and comments that repeat the next line. The repo rule is no comment by default.
13. **Unused bits.** Unused imports, variables, arguments, `props`, `emits`, `ref`s, computed values, and CSS classes.
14. **Leftovers.** `console.log`, `debugger`, stale `TODO`.
15. **Pass-through wrappers.** A function whose only job is to call one other function.
16. **Long if/else chains** that only map a value to a value. Use one lookup object.
17. **Needless middle steps.** A variable used once on the next line. A copy nothing changes.
18. **Long guard chains.** Deep `a && a.b && a.b.c`. Use `?.` and `??`. An empty `catch`, or one that only rethrows.
19. **Waste work.** The same heavy function running twice for one user action. A guessed-count loop or a timer used to force a result.

---

## 4. Before You Call Anything Dead

* Search the **whole repo** for the name, not just the module. `gitnexus_context({ name: 'symbolName' })` is fastest; ripgrep is the cross-check.
* Also check string uses: a name in a registry, a config map, a route record, or `<component :is="...">`. A call-graph tool can miss these.
* Check `git log` on the file. Something changed in the last two weeks may be half-finished work, not dead code. Flag it, do not assume.
* Never call something dead from reading one file.
* Every finding needs a real file path and real line numbers. Never report from memory. If you are not sure, say so.

---

## 5. The Report

Write it, then **stop and end your turn**. Do not edit anything.

Start with the file list and line counts.

Then one block per finding:

* **ID**: `F-01`
* **Where**: file path and line numbers
* **What**: what you found, in one or two short sentences
* **Cause**: why it is there — what it was for, and what made it stale
* **Remedy**: exactly what to do about it
* **Risk**: low / medium / high, and who else uses it

End with a small table: file, lines now, lines after, cut %. Then the total.

Last, say what you could **not** check, and why. Never let the report imply you covered more than you did.

**Rules for the report**
* Very simple, easy English. Short sentences. Small everyday words.
* No file dumps. No long code snippets. Use ✅, ⚠️, ❌, 📌.
* Report every finding you have, not just the easy ones.

---

## 6. After the User Replies

The user picks the IDs to fix. Then, and only then:

* Fix only those IDs. Nothing else.
* Run `gitnexus_impact({ target: 'symbolName', direction: 'upstream' })` before changing any symbol. Warn on HIGH or CRITICAL and wait.
* Run `git status` first. Never overwrite a whole file it lists as modified.
* One finding at a time. Behaviour stays the same.
* Never commit. Never push. Never deploy.
* Then run `npm --prefix FRONTENT run build`, and click through the real flows in the app. Never type a URL in the test browser — the record context will not load.
* Report what you did, and say plainly any approved ID you did not finish.
