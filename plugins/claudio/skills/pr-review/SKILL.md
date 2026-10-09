---
name: pr-review
description: >-
  Use when the user wants code reviewed: a GitHub PR, their local/uncommitted changes,
  or a whole-repo audit. Stack-aware (frontend, backend or both pick the reviewers),
  confidence-scored, parallel agents; --comment posts it to the PR. Triggers on
  "review this PR", "review PR 512", "review my changes", "review my uncommitted
  work", "audit my code", "audit the whole repo". Reports only; to also fix the
  findings, use review-cycle.
---

# PR Review

Review code for quality, security vulnerabilities, performance issues, and adherence to best practices using parallel focused review agents with confidence-based filtering.

**Stack-aware.** The skill classifies the changed files as frontend, backend, or both (Step 3.5) and only launches the reviewers that fit: a frontend PR gets the performance/UX/accessibility reviewer, a backend PR gets the runtime/data/API-contract reviewer, a full-stack PR gets both. Security, correctness and quality run on every PR, with their checklists switched to the languages in the diff.

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
/pr-review 463 --comment                → PR mode, also post/update the review as a PR comment
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
| `--comment` | PR mode only: post the review to the PR as a single living comment — created once, updated in place on re-runs (Step 9.5). | Off (offer at end) |

### Model Behavior

This skill defaults to the user's currently active model. It does NOT override or force a specific model for the main review. In `--lite` mode, subagents are launched with `model: sonnet` for token efficiency, but the orchestration still uses whatever model the user is running.

## Instructions

### Step 1: Parse Arguments

Extract from `$ARGUMENTS`:
1. **PR identifier** — a number (e.g., `463`), a URL, or empty
2. **Flags** — `--lite`, `--inline`, `--output <path>`, `--local`, `--full-repo`, `--comment`

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

1. **If PR identifier provided**: Run `gh pr view $PR -R {owner}/{repo} --json files,baseRefName,headRefName,headRefOid,title,url,author,number` and `gh pr diff $PR -R {owner}/{repo}`. Take `{owner}/{repo}` from the URL when one is given, else from `gh repo view --json nameWithOwner`. Always pass `-R` with a bare number: `gh` resolves it against whatever repo the cwd sits in, which in a multi-repo tree is often the wrong one.
2. **If no identifier**: Run `gh pr view --json files,baseRefName,headRefName,headRefOid,title,url,author,number` and `gh pr diff` (auto-detects current branch's PR)
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

### Step 3.5: Detect the Stack

Classify every remaining file, then set `stack`:

- **Frontend**: `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.css`, `*.scss`, `*.html`, and `*.ts`/`*.js` under `app/`, `pages/`, `components/`, `hooks/`, `ui/`, `client/`, `public/`, or in a package whose `package.json` depends on react/next/vue/svelte.
- **Backend**: `*.py`, `*.go`, `*.rb`, `*.java`, `*.kt`, `*.rs`, `*.php`, `*.sql`, migrations, and `*.ts`/`*.js` under `api/`, `server/`, `routes/`, `workers/`, `lambdas/`, Next.js route handlers (`route.ts`) and server actions (`"use server"`). Infra files (`*.tf`, `serverless.yml`, Dockerfiles, CDK, workflow YAML) count as backend.
- **Neither** (docs, config, tests only): classify by what the tests or config exercise; if still unclear, `other`.

`stack` = `frontend` | `backend` | `fullstack` (both present, each with real code, not just a type import) | `other`. Record the languages present (`typescript`, `python`, …) — Step 7 uses them to pick checklist wording.

Tests don't decide the stack on their own, but they ride along with the code they test.

### Step 4: Read Project Standards

Read relevant CLAUDE.md files for project-specific standards.

- **Full mode**: Read and save key conventions to pass to each agent.
- **Lite mode**: Read the project root CLAUDE.md but only extract code conventions, key integrations (names only), and architecture patterns relevant to the changed files. Keep the summary under 40 lines.

### Step 5: Check for Prior Reviews (Incremental Mode)

Look for an existing review file on the Desktop (or custom output dir) AND in the current conversation. The filename pattern depends on `source_mode`:

- **PR**: `{output_dir}/pr-review-{PR_NUMBER}.md`
- **Local**: `{output_dir}/pr-review-{branch-name}.md`
- **Full repo**: `{output_dir}/code-audit-{repo-name}.md`

1. **Output file**: Look for the pattern matching the current mode. Read it if it exists. If it doesn't, also glob for legacy date-suffixed files from older versions (`pr-review-{PR_NUMBER}-*.md`, etc.) — read the newest as the prior review, write updates to the new undated name, and mention the old dated file in the terminal summary so the user can delete it.
2. **Conversation**: Scan for any prior `/pr-review` output (identifiable by the `<!-- pr-review -->` marker, or a `Code review` / `## Code Review` heading from older versions). A prior file in the old format is still a valid prior review: carry its issues over and rewrite the file in the current format.

Skip incremental tracking for full-repo mode if the prior file's review date is older than 7 days (the codebase has likely shifted enough to warrant a fresh review).

If a prior review is found (from either source):

1. Extract **all existing issues** with their titles, locations, and severity levels
2. Identify issues that have been **resolved** since the last review by checking the current diff — if the problematic code no longer exists or has been fixed, mark it as resolved
3. Compile two lists:
   - **"Already Fixed"** — issues resolved since last review (these will get ~~strikethrough~~ in the updated file)
   - **"Still Open"** — issues that remain unfixed (keep as-is in the updated file)
4. Pass both lists to each agent so they skip known issues and focus on finding **new** issues only

This prevents re-flagging and enables incremental refinement of the same review file.

### Step 6: Determine Review Strategy

**Full repo mode**: Always launch the core agents for this `stack` in parallel (full review_mode) or **2 agents** (lite review_mode). Direct/inline review is never used for full-repo since scope is too large. Specialist agent triggers (Step 7) still apply, scanned across the file list.

**PR/Local mode + full review_mode** — based on the filtered diff size:
- **Small (≤3 files, ≤150 lines diff)**: Review directly in the main conversation — no subagents needed. Apply the same confidence scoring and output format, covering the focus areas this `stack` selects (below) plus any triggered specialists.
- **Medium/Large (>3 files or >150 lines diff)**: Launch the core agents for this `stack` (below) plus any triggered specialist agents (Step 7).

**PR/Local mode + lite review_mode** — based on the filtered diff size:
- **Small/Medium (≤8 files, ≤500 lines diff)**: Review directly in the main conversation. Cover the areas this `stack` selects in a single pass using the diff only. Read specific files only if you suspect a breaking change or need to check consumers of a modified export.
- **Large (>8 files or >500 lines diff)**: Launch **2 parallel Sonnet agents** (Step 7).

**Which core agents run** (both modes) depends on `stack` from Step 3.5:

| `stack` | Full mode | Lite mode (A = Security & Correctness always) |
|---|---|---|
| `frontend` | 1, 2, 3, **4F** | A, B with the frontend lens |
| `backend` | 1, 2, 3, **4B** | A, B with the backend lens |
| `fullstack` | 1, 2, 3, **4F**, **4B** | A, B with both lenses |
| `other` | 1, 2, 3 | A, B without the performance lens |

Never launch a lens the diff has no files for: a Python PR gets no re-render/bundle/a11y reviewer, a React PR gets no transaction/idempotency reviewer.

Additionally (both modes), scan the diff for **specialized review triggers**:
- **Silent failures**: If the diff contains `try`/`catch`/`except`, `.catch(`, `|| fallback`, `or default`, `contextlib.suppress`, or error handling changes → trigger Agent 5
- **Comment accuracy**: If the diff adds or modifies 5+ comment lines (`//`, `/* */`, JSDoc, `#`, or docstrings) → trigger Agent 6
- **Type design**: If the diff introduces new `type`/`interface` definitions, or new pydantic models, dataclasses, `TypedDict`s, enums, or Go/Rust structs (not just usage of existing types) → trigger Agent 7

These specialist agents run **in addition to** the core agents when triggered. They use the same confidence scoring, output format, and deduplication pipeline.

### Step 7: Launch Parallel Review Agents (when needed per Step 6)

Using the Task tool, launch agents in parallel with `subagent_type: claudio:code-reviewer` (the plugin's bundled review agent). If that agent type is unavailable for any reason, fall back to `general-purpose`.

**Full review_mode**: Launch the core agents Step 6 selected for this `stack`. Pass each agent the `stack` and languages, and tell it to skip checklist items that don't apply to them. Also pass each agent: the path to the diff file (or full file list for full-repo mode), the list of files in scope, project standards from CLAUDE.md, the current `source_mode`, and the "Already Fixed" list (if any from Step 5).

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
- **Cross-repo consumers** (backend or fullstack): when the diff removes or renames an HTTP route, changes a request/response field, or changes an event/queue payload, the callers usually live in **another repo**. Find the sibling repos (the project's CLAUDE.md usually lists them; otherwise the directories next to this repo's root) and grep them for the path, field, or event name on their deployed branches (`git -C <sibling> grep <term> origin/<base>`), not only the local checkout. A removed route that a sibling still calls is critical until you check whether that caller is actually live (feature-flagged, env-gated, dark on prod) — then say exactly which environments break.

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
- Typing for the language in the diff: TypeScript (no `any`, proper interfaces), Python (type hints on new functions, pydantic/`Literal`/`Enum` over bare `str`), etc.
- SOLID principles compliance
- DRY violations and unnecessary duplication
- Naming conventions and readability
- Error handling completeness
- Project pattern adherence (from CLAUDE.md)
- Proper abstractions and component structure
- Test coverage gaps
- **Missing companion changes**: Flag if any of these were missed:
  - Stale codegen outputs — a source-of-truth schema changed (CMS schema, GraphQL/OpenAPI spec, DB schema, protobuf) but the generated artifacts (types, clients) weren't regenerated alongside it. The project's CLAUDE.md (from Step 4) names the codegen commands and output files.
  - New environment variables added but not documented
  - New API routes without proper error handling patterns
  - (Frontend) Server component converted to client component without loading/error states
  - Changed shared types/utils without updating all consumers

**Agent 4F — Frontend Performance & UX** *(frontend/fullstack only)*:
Think like a user on a slow connection. Focus on what would degrade their experience.
- Unnecessary re-renders and missing memoization
- Inefficient queries or data fetching patterns
- Bundle size impact (distinguish client vs server — server-only packages don't affect bundle)
- Accessibility issues (ARIA, keyboard nav, screen readers)
- Edge cases and error states in UI
- Loading and error state handling
- Missing cleanup (event listeners, subscriptions, timers)
- **Dependency audit**: If `package.json` changed, flag new packages — check if they are well-maintained, have known vulnerabilities, or are unnecessarily large. Flag removed packages that might still be imported somewhere.

**Agent 4B — Backend Runtime, Data & Contracts** *(backend/fullstack only)*:
Think like the on-call engineer for this service. Focus on what breaks under real traffic, retries, and deploys.
- **Blocking I/O in async code**: sync DB/HTTP/SDK calls (boto3, `requests`, sync ORM) inside `async def` handlers without `asyncio.to_thread`/`run_in_threadpool`; the Node equivalent is sync fs/crypto on the request path
- **Data integrity**: missing transactions around multi-write operations, read-then-write races (use conditional writes / `SELECT … FOR UPDATE` / unique constraints), non-idempotent handlers for webhooks, queues, and retried requests
- **Single-use / consume-then-fail**: a token, lock, or quota consumed before steps that can fail, leaving the user unable to retry
- **API and event contracts**: removed or renamed routes, fields, enum values, or event payload keys; response models that drop fields callers read; stored records (DB rows, Dynamo items, cache) written by the old code that the new code can't read, and vice versa during a rolling deploy or rollback
- **Migrations**: destructive or locking schema changes, backfills without batching, migration and code not deployable in either order
- **Paid / rate-limited external calls**: new or ungated calls to billable third-party APIs, missing timeouts, retries without backoff or caps, N+1 calls
- **Error mapping**: exceptions mapped to the right HTTP status (4xx vs 5xx), no internal details or PII in error bodies or logs
- **Route-level tests**: new endpoints tested through the HTTP layer (auth rejected without credentials, validation errors, ownership checks), not only at the service layer
- **Dependency audit**: if `pyproject.toml`/`requirements*.txt`/`go.mod`/`Gemfile` changed, the same checks as the frontend audit

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

**Agent B — Quality & Performance** (apply only the lens(es) for this `stack`):
- Typing for the languages in the diff, DRY violations, naming, project pattern adherence
- Missing companion changes (schema change without typegen, new env vars undocumented, etc.)
- *Frontend lens*: unnecessary re-renders, inefficient data fetching, bundle size, accessibility, loading/error states
- *Backend lens*: blocking I/O in async code, transactions and races, idempotency, API/event contract changes (grep sibling repos for callers), paid external calls, route-level tests
- Dependency audit if a manifest changed

---

#### Specialist Agents (both modes, only when triggered in Step 6)

When Step 6 triggered Agent 5 (Silent Failure Hunter), 6 (Comment Accuracy) or 7 (Type Design), read `references/specialist-agents.md` and pass the triggered agent's brief to it.

### Step 8: Consolidate & Filter

After all agents complete (or after direct review for small PRs):

1. **Collect** all findings from the agents
2. **Deduplicate** — if multiple agents flagged the same issue, keep the most detailed version (higher confidence signal)
3. **Filter** — only include findings with confidence **≥ 80**
4. **Boost** — if 2+ agents flagged the same issue, boost its severity by one tier (suggestion → improvement, improvement → critical)
5. **Assess overall risk** — based on the findings, assign a PR risk level:
   - 🟢 **Low** — nothing must be fixed, minor improvements only
   - 🟡 **Medium** — nothing that breaks production, but notable improvements needed
   - 🔴 **High** — must-fix issues found
   - ⛔ **Critical** — security vulnerabilities or data loss risks

   Rate the risk by where the damage lands. Before calling a finding critical, check whether the affected path is actually live in production (feature flags, env gates, dark routes). A break that only reaches staging or a flagged-off flow is still must-fix, but say so in the finding and weigh the overall risk accordingly.
6. **Categorize** into the output format below

### Step 9: Write Review Output

**If `--inline` flag is set**: Skip file output, go directly to Step 10 (terminal summary) and include the full review details in the conversation.

**Otherwise**: Write the consolidated review to a markdown file.

**File path** depends on `source_mode` — one stable file per PR/branch/repo, no date suffix (dates live in the metadata line and the Review history):
- **PR mode**: `{output_dir}/pr-review-{PR_NUMBER}.md` (e.g. `pr-review-69.md`)
- **Local mode**: `{output_dir}/pr-review-{branch-name}.md`
- **Full repo mode**: `{output_dir}/code-audit-{repo-name}.md` (e.g. `code-audit-my-app.md`)

**If the file already exists (re-run / incremental review):**

1. **Read the existing file**
2. **Move resolved issues to "Fixed"**: For each issue from Step 5's "Already Fixed" list, remove it from its severity section and add a line to the collapsed `✅ Fixed` block: `~~1 · Missing input validation~~ fixed in {short SHA}`. Keep its number so later references still resolve.
3. **Keep open issues unchanged**: Issues from the "Still Open" list remain as-is
4. **Append new issues**: Add newly discovered issues (from Step 8) at the end of their respective severity sections, numbered continuing from the last existing issue
5. **Update the header**: recalculate the counts table (open only in the first three columns, fixed in the last), the risk, the verdict, and the metadata line (head SHA, date)
6. **Append a row** to the `Review history` block (create it if missing)

**If the file does not exist (first run):**

Write a fresh review file using the format below.

**Lite mode difference**: Do NOT include before/after code snippets (keeps output tokens low). Issues include description and impact only.

**File format:**

````markdown
<!-- pr-review -->
### Code review · {scope link} · {risk emoji} {Risk} risk

> {Verdict: one or two plain sentences. What matters most and whether it can merge. No emoji.}

| 🔴 Must fix | 🟡 Should fix | 🟢 Consider | ✅ Fixed |
|:---:|:---:|:---:|:---:|
| {n} | {n} | {n} | {n} |

<sub>{Full | Lite} review · {stack} · {n} files · head <code>{short SHA}</code> · {YYYY-MM-DD HH:MM}</sub>

#### 🔴 1 · {Short plain-English title}

[`path/to/file.py:42`]({repo-url}/blob/{headRefOid}/path/to/file.py#L42) · confidence {n}

{Problem: what is wrong, in 1-3 sentences.}

**Impact:** {who or what breaks, and where: prod, staging, a flagged-off flow.}

<details><summary>Suggested fix</summary>

```diff
- {problematic code}
+ {fixed code}
```

</details>

#### 🟡 2 · {Short plain-English title}

{Same shape as above.}

<details><summary>🟢 Consider · {n}</summary>

| # | Finding | Where |
|---|---|---|
| 3 | {one line} | [`path:line`]({link}) |

</details>

<details><summary>✅ Fixed · {n}</summary>

- ~~1 · {title}~~ fixed in `{short SHA}`

</details>

<details><summary>Done well</summary>

- {What was done well, consolidated from all agents}

</details>

<details><summary>Review history</summary>

| # | When | Mode | Change |
|---|---|---|---|
| 1 | {YYYY-MM-DD HH:MM} | Full | First review: {n} findings |

</details>
````

Scope link: PR mode `[#{number}]({url})`, local mode `` `{branch}` vs `{base}` ``, full repo `` `{repo}` @ `{short SHA}` ``.

**Format rules (the file is a GitHub comment first):**

- **Titles are plain English, short, and code-free.** No long paths or backticked routes in a heading: they render as a huge monospace block that wraps mid-word. Put identifiers in the body.
- **One emoji per finding, on its heading.** Severity is the emoji; don't repeat it in section headers or add others to the body.
- **No severity section headers.** Findings go straight after the counts table, must-fix first, then should-fix, numbered in one running sequence. A section with no findings simply doesn't appear.
- **Every metadata line stands on its own paragraph** (blank line between them). GitHub joins consecutive lines into one paragraph, which is how the old header ran together into one wrapped blob.
- **Fixes are collapsed** in `Suggested fix` and use a `diff` block rather than separate Before/After blocks, so the comment scans as a list of findings and the code is one click away. Lite mode omits the fix block.
- **Omit empty blocks**: no `Consider`, `Fixed`, or `Done well` block when it would be empty. The counts table always shows all four columns.
- **Breaking changes** that affect other repos or consumers are findings like any other (usually must-fix), not a separate section.
- The `<!-- pr-review -->` marker on line 1 is invisible when rendered and is how Step 9.5 finds the comment to update. Always include it.
- **Location links** (PR mode only): `{repo-url}/blob/{headRefOid}/{path}#L{line}`, where `{repo-url}` is the PR URL with `/pull/{n}` stripped. For a deleted file or line, link the file on the base branch instead. In local/full-repo mode use plain `` `path:line` ``.
- `<details>`: keep the blank line after `<summary>` or GitHub won't render the markdown inside.
- No footer, no attribution — when posted, this is the user's own review comment.

### Step 9.5: Post or Update the PR Comment (PR mode only)

The file is formatted to live as a PR comment. Posting maintains **one living review comment** per PR — created once, updated in place on every re-run. Never post a second review comment.

- **`--comment` passed** (PR mode): post or update now.
- **`--comment` not passed** (PR mode): skip, but end Step 10's summary with the offer to post.
- **`--comment` passed outside PR mode**: note that it only applies to PRs and continue.

When posting, read `references/post-pr-comment.md` and follow it exactly: it finds your own marker comment by author and marker, PATCHes it in place, or creates one. Never use `gh pr comment --edit-last`.

### Step 10: Show Terminal Summary

After writing the file (or in place of it for `--inline` mode), show a **brief summary** in the terminal:

```
{risk emoji} {Risk} risk ({stack}{mode_label}): {verdict sentence}
🔴 {n} must fix · 🟡 {n} should fix · 🟢 {n} consider · ✅ {n} fixed

Saved to `{output_dir}/pr-review-{name}.md`
```

Where `{mode_label}` is ` (Lite)` if `--lite` was used, empty otherwise.

If `--inline` was used, omit the "Full review saved to" line and instead output the complete review in the conversation.

If there are critical issues, list their one-line summaries in the terminal too.

If this was an incremental review (file already existed), also mention how many issues were marked as fixed.

If the review was posted or updated as a PR comment (Step 9.5), include the comment URL. In PR mode without `--comment`, end the summary with the offer: `Post this review to PR #{n} as a comment? (re-run with --comment to do it automatically)`.

If no critical issues were found, add this suggestion:
```
💡 No critical issues. Run `/simplify` to polish the changed files before merging.
```

## Review Loop Workflow

This skill is designed for iterative use. The recommended workflow:

1. **Run `/pr-review`** — get the initial review with all issues
2. **Fix the issues** — address critical and improvement items in your code
3. **Run `/pr-review` again** — the skill detects the prior review file, moves resolved issues into the `✅ Fixed` block, and surfaces any new issues introduced by the fixes
4. **Repeat** until the review is clean

Each run appends to the Review history so you can track the review history. Both full and lite runs write to the same file, so you can mix modes (e.g., full review first, then lite re-checks as you iterate).

## Review Checklist

- No critical security vulnerabilities
- Types are strict for the language (no `any`; typed Python models over bare dicts/strings)
- Backend: no blocking I/O in async handlers, writes are atomic/idempotent, API and event contracts stay compatible with every caller (including other repos)
- Error handling is complete
- Code follows project patterns (check CLAUDE.md)
- SOLID principles applied
- No unnecessary duplication
- Edge cases handled
- No race conditions or memory leaks
- Frontend: accessibility requirements met
- Test coverage adequate
- No breaking changes with unupdated consumers
- No missing companion changes (typegen, env docs, loading states)
- New dependencies are justified and safe
- No silent error swallowing in catch blocks
- Comments are accurate and not stale
- New types express their invariants (no stringly-typed state)
