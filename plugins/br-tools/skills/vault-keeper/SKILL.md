---
name: vault-keeper
description: Use when working in a project that has a registered second-brain knowledge vault (Karpathy-style LLM Wiki). Auto-fires when the user documents findings (architecture decisions, integration quirks, debugging discoveries, team facts, ticket epics), looks up domain context (team/integrations/flows/past decisions), ingests raw sources into the wiki, or asks for a vault lint/audit. Resolves the current working directory against `~/.config/br-tools/vaults.json`; if the project has no registered vault, the skill self-terminates without action. To set up a new vault, use `/vault-init`. Triggers on phrases like "save this to the vault", "what does the wiki say about X", "let's document this finding", "ingest this doc", "lint the wiki", "what's our second brain say about Y".
allowed-tools: Read, Write, Edit, Bash(jq:*), Bash(cat:*), Bash(test:*), Bash(ls:*), Bash(date:*), Bash(grep:*), Bash(find:*)
---

# Vault Keeper

A reusable skill for maintaining a personal knowledge base (Karpathy's LLM Wiki pattern) on a per-project basis. Each registered project gets a vault — a structured Obsidian-compatible markdown directory with `raw/` (immutable sources) and `wiki/` (LLM-maintained pages with cross-links and citations).

This skill makes Claude:
1. **Read from the vault** before answering domain questions (instead of re-deriving context every session)
2. **Write to the vault** proactively when discovering things worth preserving
3. **Defer to each vault's own `CLAUDE.md`** for project-specific schema rules

If the user is in a project with no registered vault, this skill **silently terminates**. Use `/vault-init` to set up a new vault.

---

## Step 1 — Resolve the current project to a vault path

Read the registry at `~/.config/br-tools/vaults.json`. Schema:

```json
{
  "vaults": {
    "/abs/path/to/project": "/abs/path/to/vault",
    "/abs/path/to/another-project": "/abs/path/to/another-vault"
  }
}
```

```bash
test -f ~/.config/br-tools/vaults.json || { echo "no-registry"; exit 0; }
cat ~/.config/br-tools/vaults.json
```

Walk up the cwd directory tree (current working directory, then parent, then parent's parent, …) and look for an exact match against the registry keys. The first match wins. This means a session in `/Users/foo/apps/myproject/subdir/` matches an entry for `/Users/foo/apps/myproject`.

```bash
# Inline resolver (Claude can run this verbatim):
DIR="$(pwd)"
VAULT=""
while [ "$DIR" != "/" ] && [ -z "$VAULT" ]; do
  VAULT=$(jq -r --arg d "$DIR" '.vaults[$d] // empty' ~/.config/br-tools/vaults.json 2>/dev/null)
  DIR="$(dirname "$DIR")"
done
echo "${VAULT:-(no vault for this project)}"
```

If no vault matches: **stop here. Do not announce the skill, do not write anything. The user's request continues normally without vault involvement.**

If a vault matches: continue to Step 2.

## Step 2 — Load the vault's schema

Each vault has its own `CLAUDE.md` at the vault root that defines project-specific rules: page format, citation conventions, ingest workflow, lint workflow, **auto-update triggers**. Read it once per session before doing any vault work:

```
{vault}/CLAUDE.md
```

The vault's CLAUDE.md is the **schema authority**. This skill provides the generic plumbing (registry lookup, when to engage); the vault's CLAUDE.md provides the specifics (what kind of facts get filed where, how to cite, how to format pages).

If the vault's `CLAUDE.md` doesn't exist, the vault is malformed — surface this to the user. Suggest they re-run `/vault-init` or write a CLAUDE.md from scratch. Do not improvise rules.

## Step 3 — Engage based on the user's intent

After loading the vault's schema, decide which mode to enter:

### Read mode (domain questions)

Triggered by: "what does X do?", "how does Y work?", "who owns Z?", "what's our setup for ...?"

1. Read `{vault}/wiki/index.md` first
2. Follow `[[wiki-links]]` to relevant pages
3. Synthesize the answer **with citations to specific wiki pages**: "see `[[eve-financing]]`"
4. If the answer isn't in the wiki, say so clearly. Then offer to investigate (read code, web search, ask user) and **file the answer back as a new wiki page**

### Write mode — proactive auto-update (no permission needed for small touches)

Triggered when, during normal work, you encounter:

- A new integration detail or quirk worth remembering → update `wiki/integrations/<service>.md`
- An architectural decision + rationale → update `wiki/projects/*.md` and/or `wiki/concepts/*.md`
- A debugging finding (root cause + reusable fix) → add or update `wiki/playbooks/<topic>.md`
- A team-member fact (ownership, expertise, contact pattern) → update `wiki/people/<name>.md`
- A multi-week epic touching multiple files → create or update `wiki/tickets/<ID>.md`
- A new term/concept used 2+ times → create `wiki/concepts/<term>.md`
- A contradiction with an existing claim → note both, mark contradiction explicitly, link to newer source

**Always after any wiki write**:
1. Refresh the entry in `{vault}/wiki/index.md`
2. Append a one-line entry to `{vault}/wiki/logs/{YYYY-MM}.md` (current month). If the file doesn't exist yet (first entry of the month), create it from the format reference at the top of the most recent monthly file in `{vault}/wiki/logs/` and prepend an entry for it to the **Months** list in `{vault}/wiki/log.md` (the index). Format: `## [YYYY-MM-DD] update | {page} | {what}`
3. If you introduced a new `[[wiki-link]]`, make sure the target page exists (stub it if needed)

**Threshold**: file a fact if knowing it would have saved 5+ minutes at session start. Skip if the source code itself documents it clearly. Don't file ephemeral status (PR review state, in-flight bugs already fixed in commits).

**For larger ingests** (a brand-new raw source, not just a small finding): use Ingest mode below.

### Ingest mode (new raw source)

Triggered by: "I added a new doc to raw/", "ingest this", or when the user drops a file in `{vault}/raw/`.

Follow the workflow defined in `{vault}/CLAUDE.md` (it's typically: read full source → discuss key takeaways with user → write summary page in `wiki/sources/` → create/update concept/entity pages → add cross-links → update index → log entry). A single source typically touches 10–15 wiki pages.

**Discuss takeaways with the user before writing anything.** Surface the 3–7 most important findings and ask which to emphasize. This is the most important step and shouldn't be skipped.

### Lint mode (audit)

Triggered by: "lint the vault", "audit the wiki", "what's stale?"

Walk the wiki and report (don't auto-fix):
- **Orphans**: pages with no inbound `[[wiki-links]]` from other pages
- **Stubs**: pages mentioned in `[[wiki-links]]` that don't exist yet
- **Contradictions**: claims that conflict between pages
- **Stale claims**: facts where `last_updated` is older than newer sources cited in the same page
- **Format violations**: missing frontmatter, missing summary, wrong filename casing
- **Index drift**: pages that exist but aren't in `index.md`, or index entries pointing to nonexistent pages

Report as a numbered list with suggested fixes.

## Step 4 — Hard rules (apply across all modes)

1. **`{vault}/raw/` top-level is immutable.** External sources are never modified — they're citation anchors. **`{vault}/raw/plans/` and `{vault}/raw/sessions/` are exempt** (living documents that user + Claude both edit). When uncertain about a vault's exact subfolder semantics, defer to its own `CLAUDE.md` — different vaults may organize raw differently.
2. **Always update `{vault}/wiki/index.md` and the current month's `{vault}/wiki/logs/{YYYY-MM}.md`** after any wiki write. (Also update `{vault}/wiki/log.md` — the index — when a new month's file is created.)
3. **Page names are lowercase-hyphenated** (with the rare exception of ticket IDs like `HPY-5611.md` if the vault's CLAUDE.md says so).
4. **No empty wiki pages.** A stubbed page gets at least a summary line and a "Related pages" section.
5. **When uncertain about categorization, ask the user.** Better to pause than to file something in the wrong folder.

## Step 5 — Tell the user what you did (briefly)

When you write to the vault, surface a short confirmation in your reply:

> Filed [[page-name]] (1 page touched), logged in `wiki/logs/{YYYY-MM}.md`.

Not a paragraph. One line per write. The user can browse the diff in Obsidian or via git.

---

## What this skill does NOT do

- It does NOT set up new vaults — that's `/vault-init`'s job
- It does NOT replace the vault's own `CLAUDE.md` — it defers to it
- It does NOT auto-trigger when no vault is registered for the cwd — it returns silently

## How vaults relate to other context layers

| Layer | Lifetime | Owner |
|---|---|---|
| **Vault wiki** (`{vault}/wiki/`) | Persistent across sessions; structured, cross-linked | Claude maintains; user reads in Obsidian |
| **Vault raw** (`{vault}/raw/`) | Immutable | User curates |
| **Memory** (`~/.claude/projects/<cwd-mangled>/memory/`) | Persistent across sessions; flat, per-cwd | Claude's own session-level scratch |
| **CLAUDE.md** (in-project) | Persistent; loaded every session in that tree | User authors |

The vault is for **knowledge that belongs to the project domain** (team, integrations, decisions, gotchas). Memory is for **session-level rules** (how the user wants Claude to communicate). CLAUDE.md is for **structural orientation** (where things are, how to run things).
