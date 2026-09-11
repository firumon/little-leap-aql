# AQL Agent Startup

> [!IMPORTANT]
> **STOP. Read [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md) in full before your first action in this session.**
>
> This is not a reference link. It is a hard rule.
>
> - Read `AGENTS.md` **before** you answer, plan, search, or edit anything — even for a small or "quick" question.
> - Do this in **every new session**, and again after any context summary or compaction.
> - `AGENTS.md` is the canonical startup file for **all** agents in this repo. `CLAUDE.md` exists only because Claude Code loads it on its own.
> - **`AGENTS.md` outranks `CLAUDE.md`.** If the two ever disagree, `AGENTS.md` wins.
> - Do not skip it, skim it, or work from memory of it. Open the file each session.
>
> It holds the startup sequence, the MACP protocol check, initialization prompt routing, the skills hierarchy, and the verification rules.

> [!IMPORTANT]
> **Protocol check before anything else**: If the request mentions **MACP**, the Multi-Agent Collaborative Protocol, the Architect/Builder relay workflow, or asks you to act as the **Architect Agent**, read [MACP.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/MACP.md) in full and operate strictly under that protocol for the rest of the session — two-turn handshake (capability tier, then task), bare Directive Prompts with no surrounding commentary, pasted messages treated as Builder output, and a hard halt after every question, directive, or proposal. See the MACP section in AGENTS.md.

# Code Comments — Keep Them Rare

Write code that explains itself. Do not narrate it.

- **Default: no comment.** No JSDoc blocks, no file-header docblocks, no section banners, no restating what the next line does.
- A comment is allowed only when the code cannot carry the information — a non-obvious constraint, a workaround, or a decision a reader would otherwise undo.
- When one is truly warranted: **1 line, 2 at the very most.** Never a paragraph, never a rationale essay.
- Prefer a clearer name, a smaller function, or a well-named constant over any comment.
- This applies to every language in the repo — `.vue`, `.js`, `.gs` alike.
- Write the few comments you keep in very simple, easy English. Short sentence. Small words.

**Clean up as you go.** Whenever you edit a file, delete the long comments and docblocks you find in it. Keep nothing unless it is genuinely load-bearing, and then strip it to 1 line (2 at the very most). This is expected in the diff, not scope creep — but stay inside the file you were already editing.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **little-leap-aql** (14531 symbols, 23540 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/little-leap-aql/context` | Codebase overview, check index freshness |
| `gitnexus://repo/little-leap-aql/clusters` | All functional areas |
| `gitnexus://repo/little-leap-aql/processes` | All execution flows |
| `gitnexus://repo/little-leap-aql/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# My Mistake Log (Agent Self-Accountability)

> [!IMPORTANT]
> This is a live log of mistakes I have made in this repo. Read it at the start of every
> session, together with `AGENTS.md`. Each row is a rule I already broke once. Do not
> break it again.

| # | Nature of Violation / Mistake | Short Description | Times Made | What I Must Do Next Time |
|---|---|---|---|---|
| 1 | Reported work as done when it was not | The user asked to fix `MarkDeliver` and the other delivery actions the same way as `Add`. I only did part of it, then wrote a report with a route-by-route table that read as if all routes were done. The user had to find the gap. | 1 | Before writing any report, re-read the user's prompt sentence by sentence. Tick each sentence against what I actually changed. Say plainly which parts I did NOT do, and why. Never let a verification table imply coverage I did not deliver. |
| 2 | Wrote wrong data to the live sheet | I used `deriveParentRestockProgress` without thinking through a mixed `ALLOCATED` + `PENDING` child set. It wrote `PENDING_APPROVAL` and un-approved an approved restock (`ORS26000070`). I had already read that function's body. | 1 | Before I call a domain function, walk EVERY input case it can meet, not only the happy one. Write the cases down. If a function decides a workflow state, list every state it can return and ask if each one is legal in my situation. |
| 3 | Overwrote an uncommitted file without checking | I ran `cat > Add.js` on a file that `git status` had already shown me as modified and uncommitted. Nothing was lost only by luck, because I had read it earlier in the same session. | 1 | Never overwrite a whole file that `git status` lists as modified. Read it first in the same turn, then use a targeted edit. Use full-file writes only for files I created, or after I have just read the file. |
| 4 | Judged state before the work had settled | (a) I told the user every Add page was stuck and the breakage was app-wide. It was not — pages were slow against the Apps Script backend and I polled faster than the transitions settled, and to test it I stashed and popped 50 modified files of the user's work. (b) I re-ran the widget harness, saw the same 19 clipping widgets, and concluded the fix directive had been missed. The measurement was right; the conclusion was wrong. Another agent was still working on those fixes. | 2 | Do not judge from a snapshot. Before saying something is broken, ignored, or unchanged, ask whether the work is still in flight or the app is merely slow. Report what I measured and when, and say plainly that I do not know the cause — never assert why. Never stash or pop the user's uncommitted work to run a test. |
| 5 | Flagged a rule break instead of fixing it | I kept `WarehouseRequired` as a derived flag in `controls`, saw it conflicted with `UI_PAGE_STATE_NODES.md` §5B.5, wrote a note, and moved on. The user's very next prompt was about exactly that kind of violation. | 1 | When I can see a canonical rule and I am choosing the easy way instead, stop. Either fix it properly, or ask the user before I settle for the shortcut. A note in the report is not a substitute for doing it right. |
| 6 | Missed a required parallel update because I classified the task too narrowly | I added a sheet menu item and 11 dialog callbacks across several directives, and never once updated `TENANTS/tenant.gs`. `multi_tenant_system.md` §3 states the rule plainly, but I classified the work as schema/backend only, never loaded that prompt, and my verification tables read as full coverage each time. The user found the gap. | 1 | Classification picks what I read, not what the task touches. Before I call any work done, ask what OTHER surfaces the change reaches — tenant wrappers, docs, sheet formulas, registries — and check each against its canonical rule. A new menu item or any `google.script.run` target ALWAYS means `TENANTS/tenant.gs` too. A verification table must list the surfaces I did not check, not just the ones I did. |

## How to keep this list

- I should take extra care from now onwards, so that such mistakes and errors do not happen
  from me again.
- If the user notifies me of any mistake, I have to update this list in the same turn.
- **One row per NATURE of mistake.** If the same nature happens again, I do NOT add a second
  row for it. I find the row that already covers it and **increment the count**.
- When I increment a count, I may **reword the Short Description and the remedy a little**,
  so the row also fits the new case. That is allowed and expected. Keep the nature the same,
  keep the row in place, and make the wording cover both times.
- I add a NEW row only when the nature is genuinely different from every row above.
