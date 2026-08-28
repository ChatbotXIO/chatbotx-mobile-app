---
description: Audit the project's AI infrastructure (agents, skills, commands, context, rules) for gaps, drift, and security issues
allowed-tools: Bash, Read, Grep, Glob, Task
---

Run a focused audit of the repo's AI-assist infrastructure and report findings — analysis only, no edits.

## Scope

In scope: `.claude/` (agents, commands, settings), `.agents/` (skills, rules), `.github/copilot-instructions.md`, root `SKILL.md`, `AGENTS.md`, `CLAUDE.md`. **Out of scope:** editor-specific `.cursor/**` and Devin agent config.

## Steps

1. **Inventory** — list every in-scope file with line count and git-tracked/ignored status (`git ls-files`, `git check-ignore`). Flag untracked load-bearing config and missing referenced paths (e.g. a rules dir referenced by `AGENTS.md` that does not exist on disk).

2. **Coverage & drift** — check that each tool's context (Claude, Copilot, and any editor-rule mirrors) carries the project invariants from `AGENTS.md`; flag any tool whose context omits them, and any invariant duplicated across files that can drift.

3. **Skills & commands** — flag skills >400 lines (split candidates), skills/commands that duplicate a `~/.claude/` global, and prompts with no stop condition or with phantom commands.

4. **Security** — scan `.claude/settings.local.json` for credential literals (report by location, never reproduce the value), wildcard `Bash(* )` grants, `.env`-copy/home-dir/`/etc` read grants, and machine-absolute or wrong-repo paths.

5. **Report** — findings table `file:line | issue | severity | fix`, severity-ranked. For a deep pass, read the `security-review` skill and dispatch specialist agents (`rag-eval`, `invariant-guard`) when relevant.

## Arguments

$ARGUMENTS — optional surface to focus on (e.g. `skills`, `security`, `context`).

## Guardrails

- Analysis only — never edit infra files; output findings + recommendations.
- Never reproduce secret values; reference by `file:line` only.
- Cite real `path:line` for every finding; drop anything you cannot evidence.
