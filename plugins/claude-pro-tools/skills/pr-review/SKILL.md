---
name: pr-review
description: Confidence-scored review with parallel agents, incremental tracking, and desktop file output. Three modes — (1) PR mode reviews a GitHub PR by number or auto-detected from the current branch. (2) Local mode reviews uncommitted changes plus commits ahead of main when no PR exists. (3) Full-repo mode reviews the entire codebase when the user explicitly asks for a full audit ("audit the whole repo", "review the entire codebase", "full repo audit"). Auto-triggers on phrases like "review this PR", "review my changes", "audit my code", "review my uncommitted work", "audit the whole repo".
---

# PR Review

Review code for quality, security vulnerabilities, performance issues, and adherence to best practices using parallel focused review agents with confidence-based filtering.

**General-purpose review skill optimized for TypeScript/JavaScript projects.** Works with any language but includes specialized checks for React, Next.js, and TypeScript codebases. Agents automatically adapt — frontend-specific checks (re-renders, bundle size, a11y) are only flagged when relevant to the changed files.

## Modes

| Mode | When | Input |
|------|------|-------|
| **PR** (default) | A PR number is provided OR auto-detected from the current branch | The PR's diff |
| **Local** | No PR exists, OR user passes `--local`, OR user asks to "review my uncommitted changes" / "review my branch" | `git diff origin/<base>...HEAD` + uncommitted working tree |
| **Full repo** | User passes `--full-repo`, OR explicitly asks for a "full repo audit" / "review the entire codebase" / "audit the whole repo" | Every source file in the repo (with sensible exclusions) |

## Arguments

`$ARGUMENTS` - Optional PR number/URL plus optional flags.

**Examples:**

```
/pr-review 463                          → PR mode, full review, saved to ~/Desktop
/pr-review 463 --lite                   → PR mode, lightweight (fewer agents, diff-only)
/pr-review 463 --inline                 → PR mode, conversation output only (no file)
/pr-review 463 --output ~/reviews       → PR mode, custom output directory
/pr-review                              → Auto-detect PR from current branch (falls back to local mode if no PR)
/pr-review --local                      → Force local mode (review branch diff vs main + uncommitted)
/pr-review --full-repo                  → Full repo audit (every source file)
/pr-review --full-repo --lite           → Full repo audit, lightweight
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--lite` | Lightweight: 2 agents (sonnet), diff-only reads, no code snippets | Off (full mode) |
| `--inline` | Output review to conversation only, skip file output | Off (writes to file) |
| `--output <path>` | Custom directory for review file output | `~/Desktop` |
| `--local` | Force local mode (review uncommitted + branch diff vs main, ignore PRs) | Off (auto-detect) |
| `--full-repo` | Audit the entire codebase, not a diff. Confirm with the user first if the repo has >50 source files. | Off |

### Model Behavior

This skill defaults to the user's currently active model. It does NOT override or force a specific model for the main review. In `--lite` mode, subagents are launched with `model: sonnet` for token efficiency, but the orchestration still uses whatever model the user is running.

## Instructions

### Step 1: Parse Arguments

Extract from `$ARGUMENTS`:
1. **PR identifier** — a number (e.g., `463`), a URL, or empty
2. **Flags** — `--lite`, `--inline`, `--output <path>`, `--local`, `--full-repo`

Determine `source_mode`:
- `--full-repo` present → `source_mode = "full-repo"`
- `--local` present → `source_mode = "local"`
- PR identifier present → `source_mode = "pr"`
- Neither: try PR auto-detect first, fall back to `local` if no PR found

Determine `review_mode` (depth):
- `review_mode = "full"` (unless `--lite` is present, then `"lite"`)

Determine output:
- `output = "file"` (unless `--inline` is present, then `"inline"`)
- `output_dir = "~/Desktop"` (unless `--output <path>` overrides)

### Step 2: Get Review Input

Behavior depends on `source_mode`:

#### PR mode

1. **If PR identifier provided**: Run `gh pr view $PR --json files,baseRefName,headRefName,title,url,author,number` and `gh pr diff $PR`
2. **If no identifier**: Run `gh pr view --json files,baseRefName,headRefName,title,url,author,number` and `gh pr diff` (auto-detects current branch's PR)
3. **If both fail**: Switch to `source_mode = "local"` and follow that path below.

Save the full diff, list of changed files, and PR metadata (title, number, branch, URL).

#### Local mode

1. Determine the base branch: `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'` (usually `main` or `master`).
2. Get changed files: `git diff --name-only origin/<base>...HEAD` for committed changes ahead of base, plus `git diff --name-only` for uncommitted, plus `git diff --name-only --cached` for staged. Deduplicate.
3. Get the diff: `git diff origin/<base>...HEAD` for committed delta, plus `git diff` for uncommitted, plus `git diff --cached` for staged. Concatenate.
4. Capture metadata: current branch name (`git rev-parse --abbrev-ref HEAD`), base branch, repo name (`basename "$(git rev-parse --show-toplevel)"`).

Use the branch name as the identifier for naming the output file.

#### Full repo mode

1. List every tracked source file: `git ls-files`. Apply the noise filter (Step 3) PLUS full-repo exclusions: `node_modules/`, `.next/`, `dist/`, `build/`, `.git/`, `coverage/`, `*.snap`, `**/__snapshots__/**`, `public/**` (binary assets), `*.png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf`, `*.min.js`, `*.map`.
2. Count remaining files. **If >50 files: pause and ask the user to confirm before proceeding** (mention file count, est. token cost, and offer `--lite` as an alternative).
3. Capture metadata: repo name (`basename "$(git rev-parse --show-toplevel)"`), current commit SHA (`git rev-parse --short HEAD`).
4. There's no diff for full-repo mode — agents will read the files directly. Skip diff-based logic in later steps; agents review whole files.

### Step 3: Filter Noise Files

Before reviewing, remove noise from the file list and diff:

- **Skip lock files**: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`
- **Skip generated files**: `*.types.ts` (unless hand-edited), `*.gen.*`, `*.generated.*`
- **Skip pure formatting changes** (lite mode only): files where the diff only contains whitespace, import reordering, or auto-generated content
- **Keep `package.json`** — still important for dependency audit

Count remaining files and diff lines after filtering.

### Step 4: Read Project Standards

Read relevant CLAUDE.md files for project-specific standards.

- **Full mode**: Read and save key conventions to pass to each agent.
- **Lite mode**: Read the project root CLAUDE.md but only extract code conventions, key integrations (names only), and architecture patterns relevant to the changed files. Keep the summary under 40 lines.

### Step 5: Check for Prior Reviews (Incremental Mode)

Look for an existing review file on the Desktop (or custom output dir) AND in the current conversation. The filename pattern depends on `source_mode`:

- **PR**: `{output_dir}/pr-review-{PR_NUMBER}-{YYYY-MM-DD}.md`
- **Local**: `{output_dir}/pr-review-{branch-name}-{YYYY-MM-DD}.md`
- **Full repo**: `{output_dir}/code-audit-{repo-name}-{YYYY-MM-DD}.md`

1. **Output file**: Look for the pattern matching the current mode. Read it if it exists.
2. **Conversation**: Scan for any prior `/pr-review` output (identifiable by `## Code Review` heading).

Skip incremental tracking for full-repo mode if the prior file is older than 7 days (the codebase has likely shifted enough to warrant a fresh review).

If a prior review is found (from either source):

1. Extract **all existing issues** with their titles, locations, and severity levels
2. Identify issues that have been **resolved** since the last review by checking the current diff — if the problematic code no longer exists or has been fixed, mark it as resolved
3. Compile two lists:
   - **"Already Fixed"** — issues resolved since last review (these will get ~~strikethrough~~ in the updated file)
   - **"Still Open"** — issues that remain unfixed (keep as-is in the updated file)
4. Pass both lists to each agent so they skip known issues and focus on finding **new** issues only

This prevents re-flagging and enables incremental refinement of the same review file.

### Step 6: Determine Review Strategy

**Full repo mode**: Always launch **4 core agents** in parallel (full review_mode) or **2 agents** (lite review_mode). Direct/inline review is never used for full-repo since scope is too large. Specialist agent triggers (Step 7) still apply, scanned across the file list.

**PR/Local mode + full review_mode** — based on the filtered diff size:
- **Small (≤3 files, ≤150 lines diff)**: Review directly in the main conversation — no subagents needed. Apply the same confidence scoring and output format, covering all focus areas (core 4 + any triggered specialists).
- **Medium/Large (>3 files or >150 lines diff)**: Launch **4 core agents** plus any triggered specialist agents (Step 7).

**PR/Local mode + lite review_mode** — based on the filtered diff size:
- **Small/Medium (≤8 files, ≤500 lines diff)**: Review directly in the main conversation. Cover all 4 areas in a single pass using the diff only. Read specific files only if you suspect a breaking change or need to check consumers of a modified export.
- **Large (>8 files or >500 lines diff)**: Launch **2 parallel Sonnet agents** (Step 7).

Additionally (both modes), scan the diff for **specialized review triggers**:
- **Silent failures**: If the diff contains `try`/`catch`, `.catch(`, `|| fallback`, or error handling changes → trigger Agent 5
- **Comment accuracy**: If the diff adds or modifies 5+ comment lines (single-line `//` or block `/* */` or JSDoc `/** */`) → trigger Agent 6
- **Type design**: If the diff introduces new `type` or `interface` definitions (not just usage of existing types) → trigger Agent 7

These specialist agents run **in addition to** the core agents when triggered. They use the same confidence scoring, output format, and deduplication pipeline.

### Step 7: Launch Parallel Review Agents (when needed per Step 6)

Using the Task tool, launch agents in parallel with `subagent_type: feature-dev:code-reviewer`.

**Full review_mode**: Launch **4 core agents**. Pass each agent: the path to the diff file (or full file list for full-repo mode), the list of files in scope, project standards from CLAUDE.md, the current `source_mode`, and the "Already Fixed" list (if any from Step 5).

**Lite review_mode**: Launch **2 agents** with `model: sonnet`. Pass each agent: the path to the diff file (or full file list), the filtered file list, the source_mode, and the brief conventions summary (not the full CLAUDE.md).

**For full-repo source_mode**: Tell agents to read the listed files directly (no diff exists). Each agent should still apply confidence scoring, but findings are ranked by impact relative to the whole codebase rather than the changes-of-interest framing used in PR/local modes.

---

#### Full Mode Agent Instructions

Instruct each agent to:
- **Read the diff file** first, then **read every changed source file in full** (not just the diff — context matters)
- Score each finding with a **confidence level (0-100)**:
  - 0 = likely false positive or pre-existing issue
  - 50 = might be an issue but could be a nitpick
  - 75 = very likely a real issue
  - 100 = absolutely certain this is a real issue
- Categorize each finding by severity: **critical**, **improvement**, or **suggestion**
- For each finding, include **before/after code snippets** showing the problematic code and the fix inline
- Note **good practices** observed in the code
- Return findings as a structured list

**Agent 1 — Security**:
Think like an attacker. Focus on how this code could be exploited.
- Input validation and sanitization
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication and authorization checks
- Sensitive data exposure (tokens, passwords, PII in logs)
- CSRF, CORS, and header security
- Insecure deserialization or eval usage
- **Breaking changes**: Check if modified types, exports, or API route signatures have consumers outside the PR that need updating. Search for usages of changed interfaces, function signatures, and exports across the codebase — flag any that weren't updated.

**Agent 2 — Correctness**:
Think like a QA engineer. Focus on what could go wrong at runtime.
- Race conditions and concurrency issues
- Null/undefined handling and type safety
- Logic errors and off-by-one mistakes
- Memory leaks and resource cleanup
- State management bugs (stale closures, missing deps in hooks)
- Error propagation — are errors caught, surfaced, or silently swallowed?
- Edge cases: empty arrays, zero values, undefined optional fields, boundary conditions

**Agent 3 — Code Quality & Conventions**:
Think like a senior reviewer on the team. Focus on maintainability and standards.
- TypeScript typing (no `any`, proper interfaces)
- SOLID principles compliance
- DRY violations and unnecessary duplication
- Naming conventions and readability
- Error handling completeness
- Project pattern adherence (from CLAUDE.md)
- Proper abstractions and component structure
- Test coverage gaps
- **Missing companion changes**: Flag if any of these were missed:
  - Sanity schema changed but `pnpm sanity:typegen` may not have been run (check if `sanity.types.ts` was updated)
  - New environment variables added but not documented
  - New API routes without proper error handling patterns
  - Server component converted to client component without loading/error states
  - Changed shared types/utils without updating all consumers

**Agent 4 — Performance & UX**:
Think like a user on a slow connection. Focus on what would degrade their experience.
- Unnecessary re-renders and missing memoization
- Inefficient queries or data fetching patterns
- Bundle size impact (distinguish client vs server — server-only packages don't affect bundle)
- Accessibility issues (ARIA, keyboard nav, screen readers)
- Edge cases and error states in UI
- Loading and error state handling
- Missing cleanup (event listeners, subscriptions, timers)
- **Dependency audit**: If `package.json` changed, flag new packages — check if they are well-maintained, have known vulnerabilities, or are unnecessarily large. Flag removed packages that might still be imported somewhere.

---

#### Lite Mode Agent Instructions

Instruct both agents to:
- **Review from the diff only** — do NOT read every changed file in full
- **Use the Read tool selectively** — only read a file when you need to check consumers of a changed export, verify a breaking change, or understand surrounding context for a suspicious pattern
- Score each finding with a **confidence level (0-100)** (same scale as full mode)
- Categorize each finding by severity: **critical**, **improvement**, or **suggestion**
- Note **good practices** observed
- Return findings as a structured list

**Agent A — Security & Correctness**:
- Input validation, injection vulnerabilities, auth checks, sensitive data exposure
- Breaking changes: check if modified exports/types/APIs have consumers that need updating (use Read tool to search for usages only when a signature change is detected in the diff)
- Race conditions, null/undefined handling, logic errors, edge cases
- Error propagation — are errors caught or silently swallowed?
- State management bugs (stale closures, missing hook deps)

**Agent B — Quality & Performance**:
- TypeScript typing (no `any`, proper interfaces)
- DRY violations, naming, project pattern adherence
- Missing companion changes (schema change without typegen, new env vars undocumented, etc.)
- Unnecessary re-renders, inefficient data fetching, bundle size impact
- Accessibility issues, loading/error states
- Dependency audit if `package.json` changed

---

#### Specialist Agents (both modes, only when triggered in Step 6)

**Agent 5 — Silent Failure Hunter** *(only if triggered)*:
Think like an oncall engineer paged at 3am. Focus on errors that would be invisible until production.
- `catch` blocks that swallow errors (empty catch, catch with only `console.log`)
- Fallback values that mask failures (defaults that hide broken state)
- Missing error propagation (async functions that don't await or handle rejections)
- Logging gaps — errors caught but not logged, or logged at wrong severity
- Retry logic without backoff or max attempts
- Status checks that return success even on partial failure

**Agent 6 — Comment Accuracy** *(only if triggered)*:
Think like a developer reading this code 6 months from now. Focus on whether comments help or mislead.
- Comments that contradict the code they describe
- Stale comments referencing removed/renamed variables, functions, or logic
- TODO/FIXME/HACK comments without context or tracking
- Over-commenting (restating what the code clearly does)
- Under-commenting (complex logic with no explanation)
- JSDoc/docstring parameter mismatches (wrong types, missing params, extra params)

**Agent 7 — Type Design** *(only if triggered)*:
Think like a library author. Focus on whether new types express their invariants correctly.
- Types that allow invalid states (e.g., `status: string` instead of a union type)
- Missing `readonly` modifiers on immutable data
- Overly broad types (`any`, `object`, `Record<string, unknown>`) where narrower types are possible
- Discriminated unions that should be used but aren't
- Types that don't enforce their business rules (e.g., email as `string` vs branded type)
- Exported types that leak implementation details

### Step 8: Consolidate & Filter

After all agents complete (or after direct review for small PRs):

1. **Collect** all findings from the agents
2. **Deduplicate** — if multiple agents flagged the same issue, keep the most detailed version (higher confidence signal)
3. **Filter** — only include findings with confidence **≥ 80**
4. **Boost** — if 2+ agents flagged the same issue, boost its severity by one tier (suggestion → improvement, improvement → critical)
5. **Assess overall risk** — based on the findings, assign a PR risk level:
   - 🟢 **LOW** — No critical issues, minor improvements only
   - 🟡 **MEDIUM** — No critical issues, but notable improvements needed
   - 🔴 **HIGH** — Critical issues found that must be addressed
   - ⛔ **CRITICAL** — Security vulnerabilities or data loss risks
6. **Categorize** into the output format below

### Step 9: Write Review Output

**If `--inline` flag is set**: Skip file output, go directly to Step 10 (terminal summary) and include the full review details in the conversation.

**Otherwise**: Write the consolidated review to a markdown file.

**File path** depends on `source_mode`:
- **PR mode**: `{output_dir}/pr-review-{PR_NUMBER}-{YYYY-MM-DD}.md` (e.g. `pr-review-69-2026-02-10.md`)
- **Local mode**: `{output_dir}/pr-review-{branch-name}-{YYYY-MM-DD}.md`
- **Full repo mode**: `{output_dir}/code-audit-{repo-name}-{YYYY-MM-DD}.md` (e.g. `code-audit-happy-checkout-sk-2026-05-01.md`)

**If the file already exists (re-run / incremental review):**

1. **Read the existing file**
2. **Strike through resolved issues**: For each issue from Step 5's "Already Fixed" list, wrap its title in ~~strikethrough~~ and add a `✅ Fixed` badge. Keep the issue content visible but clearly marked as resolved. Example:
   ```markdown
   ### ~~1. Missing input validation~~ ✅ Fixed
   ```
3. **Keep open issues unchanged**: Issues from the "Still Open" list remain as-is
4. **Append new issues**: Add newly discovered issues (from Step 8) at the end of their respective severity sections, numbered continuing from the last existing issue
5. **Update the header**: Recalculate issue counts (open only — exclude fixed), update overall risk level, update the date
6. **Update the "Issues by File" section** to reflect current state
7. **Append a revision entry** to the `## Revision Log` at the bottom (create the section if it doesn't exist)

**If the file does not exist (first run):**

Write a fresh review file using the format below.

**Lite mode difference**: Do NOT include before/after code snippets (keeps output tokens low). Issues include description and impact only.

**File format:**

```markdown
# Code Review: PR #{number} — {title}

**Branch**: `{headRefName}` → `{baseRefName}`
**Author**: {author}
**URL**: {url}
**Review mode**: {Full | Lite}
**Last reviewed**: {YYYY-MM-DD HH:MM}
**Files reviewed**: {count} | **Skipped**: {count} (lock/generated)

---

[risk emoji] **Overall Risk: [LEVEL]** — [one-sentence summary]

**Issues**: [🔴 count] | [🟡 count] | [🟢 count] | ~~Fixed: count~~

---

## 🔴 Critical Issues (Must Fix)

### 1. [Title]

**Location**: `file/path.ts:42`
**Confidence**: 92/100
**Impact**: [Why it matters]

**Problem**: [Clear description]

```[lang]
// Before (full mode only)
[problematic code]
```

```[lang]
// After (full mode only)
[fixed code]
```

---

## 🟡 Improvements (Should Fix)

[Same format as above]

## 🟢 Suggestions (Consider)

[Same format but can use condensed table for minor items]

| # | Finding | File | Conf |
|---|---------|------|------|
| 1 | [description] | `path:line` | 82 |

## ⚠️ Breaking Changes & Dependencies

[Modified exports/types/APIs with external consumers that may need updating]
[New/removed packages and their implications]
(Omit this section if nothing to report)

## ✅ Good Practices Observed

- [What was done well — consolidated from all agents]

## 📁 Issues by File

- `src/lib/auth.ts` — 1 🔴, 1 🟡
- `src/components/form.tsx` — 2 🟡
- `src/app/api/route.ts` — 1 🟢

## Revision Log

| # | Time | Mode | Summary |
|---|------|------|---------|
| 1 | {YYYY-MM-DD HH:MM} | Full | Initial review — X issues found |
| 2 | {YYYY-MM-DD HH:MM} | Lite | Re-review — Y fixed, Z new |

---

*Generated by [pr-review](https://github.com/bernardorubin/claude-plugins) for [Claude Code](https://claude.ai/code)*
```

### Step 10: Show Terminal Summary

After writing the file (or in place of it for `--inline` mode), show a **brief summary** in the terminal:

```
## PR Review Complete {mode_label}

[risk emoji] **Overall Risk: [LEVEL]** — [one-sentence summary]
**Issues**: 🔴 [n] | 🟡 [n] | 🟢 [n] | ~~Fixed: [n]~~

Full review saved to: `{output_dir}/pr-review-{name}.md`
```

Where `{mode_label}` is ` (Lite)` if `--lite` was used, empty otherwise.

If `--inline` was used, omit the "Full review saved to" line and instead output the complete review in the conversation.

If there are critical issues, list their one-line summaries in the terminal too.

If this was an incremental review (file already existed), also mention how many issues were marked as fixed.

If no critical issues were found, add this suggestion:
```
💡 No critical issues. Run `/simplify` to polish the changed files before merging.
```

## Review Loop Workflow

This skill is designed for iterative use. The recommended workflow:

1. **Run `/pr-review`** — get the initial review with all issues
2. **Fix the issues** — address critical and improvement items in your code
3. **Run `/pr-review` again** — the skill detects the prior review file, checks which issues are now resolved (marks them with ~~strikethrough~~ ✅ Fixed), and surfaces any new issues introduced by the fixes
4. **Repeat** until the review is clean

Each run appends to the Revision Log so you can track the review history. Both full and lite runs write to the same file, so you can mix modes (e.g., full review first, then lite re-checks as you iterate).

## Review Checklist

- No critical security vulnerabilities
- TypeScript types are strict (no `any`)
- Error handling is complete
- Code follows project patterns (check CLAUDE.md)
- SOLID principles applied
- No unnecessary duplication
- Edge cases handled
- No race conditions or memory leaks
- Accessibility requirements met
- Test coverage adequate
- No breaking changes with unupdated consumers
- No missing companion changes (typegen, env docs, loading states)
- New dependencies are justified and safe
- No silent error swallowing in catch blocks
- Comments are accurate and not stale
- New types express their invariants (no stringly-typed state)
