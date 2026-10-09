# Specialist review agents

Loaded by pr-review Step 7 only when Step 6 triggered one of these. Same confidence scoring and output format as the core agents.

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
