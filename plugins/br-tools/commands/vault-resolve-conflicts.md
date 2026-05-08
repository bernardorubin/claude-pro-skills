# Resolve Vault Conflicts (Keep Both Sides)

Auto-resolve merge/stash conflicts in a registered vault by keeping BOTH the incoming and local changes for every conflict block. Designed for vault files like `wiki/log.md` (append-only chronological), `wiki/index.md` (TOC), and other markdown content where union-merging is almost always the right call.

**Vault-only**: this command refuses to run outside a directory registered in `~/.config/br-tools/vaults.json`. Union-merging code files can produce syntactically broken output; markdown logs/lists tolerate it well.

## When to use

- After `git stash pop` / `git stash apply` produces conflicts on vault markdown
- After `git pull` / `git merge` leaves conflicts on vault markdown
- Any time you'd otherwise hand-edit `<<<<<<<` / `=======` / `>>>>>>>` markers and the answer is "keep both"

## Instructions

Run the steps below in order. Stop and surface to the user if any diagnostic fails.

### Step 1 — Resolve cwd to a registered vault

```bash
test -f ~/.config/br-tools/vaults.json || { echo "❌ No vault registry at ~/.config/br-tools/vaults.json. Run /vault-init first."; exit 1; }

DIR="$(pwd)"
VAULT=""
while [ "$DIR" != "/" ] && [ -z "$VAULT" ]; do
  VAULT=$(jq -r --arg d "$DIR" '.vaults[$d] // empty' ~/.config/br-tools/vaults.json 2>/dev/null)
  DIR="$(dirname "$DIR")"
done

if [ -z "$VAULT" ]; then
  echo "❌ Current directory is not inside a registered vault. This command is vault-only by design."
  echo "   Registered vaults: $(jq -r '.vaults | keys | .[]' ~/.config/br-tools/vaults.json)"
  exit 1
fi

echo "✅ Vault: $VAULT"
```

If no vault matches, **stop**. Do not attempt resolution outside a vault.

### Step 2 — List unmerged files

```bash
UNMERGED=$(git -C "$VAULT" diff --name-only --diff-filter=U)
if [ -z "$UNMERGED" ]; then
  echo "✅ No conflicts in vault. Nothing to resolve."
  exit 0
fi
echo "Files with conflicts:"
echo "$UNMERGED"
```

### Step 3 — Union-merge each conflicted file

For each unmerged path, extract the three stages from the index (base, ours, theirs) and re-merge with `git merge-file --union`. This keeps both halves of every conflict hunk and drops the conflict markers.

```bash
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

cd "$VAULT"

echo "$UNMERGED" | while IFS= read -r f; do
  [ -z "$f" ] && continue

  # Extract the three stages. If a stage is missing (added on one side only),
  # fall back to /dev/null so merge-file still has 3 inputs.
  git show ":1:$f" > "$TMP/base" 2>/dev/null || : > "$TMP/base"
  git show ":2:$f" > "$TMP/ours" 2>/dev/null || : > "$TMP/ours"
  git show ":3:$f" > "$TMP/theirs" 2>/dev/null || : > "$TMP/theirs"

  # --union concatenates both halves of every conflict block, no markers left.
  # Result is written into the "ours" file (first arg).
  git merge-file --union -L "ours" -L "base" -L "theirs" \
    "$TMP/ours" "$TMP/base" "$TMP/theirs"

  cp "$TMP/ours" "$f"
  git add "$f"
  echo "  ✅ $f"
done
```

### Step 4 — Verify and report

After resolving, do NOT auto-commit. Show the user what was done so they can review.

```bash
echo ""
echo "── Status after resolution ──"
git -C "$VAULT" status

echo ""
echo "── Per-file diff summary ──"
echo "$UNMERGED" | while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo ""
  echo "── $f ──"
  git -C "$VAULT" diff --cached --stat -- "$f"
done

echo ""
echo "✅ All conflicts union-merged. Review with 'git diff --cached', then commit when ready."
echo ""
echo "⚠️  Heads-up: union merge can leave near-duplicate lines when both sides edited the SAME line"
echo "   (e.g., a status update). Skim the diff for those — pick one and delete the other."
```

After the script runs, **read the resolved files yourself** (Read tool) for any near-duplicate adjacent lines that are clearly the "same fact, two phrasings" pattern. Surface those to the user with line numbers and ask which to keep — don't auto-pick.

Common near-duplicate patterns to flag:
- Same `[[wiki-link]]` appearing twice with different status text on adjacent lines
- Same `## [YYYY-MM-DD] {op} | {target}` heading repeated with different notes
- Same bullet repeated with different parenthetical

For pure additions (each side added different new content), no flagging needed — both belong.

## Why union merge

- `wiki/log.md` is **append-only chronological** — Karpathy's pattern. Both sides almost always added new entries; union concatenates them. The user sorts by date afterward if needed.
- `wiki/index.md` is a **TOC** — both sides usually added new entries to category lists. Union keeps all of them.
- Cross-link additions and citation additions in concept/integration pages are also pure additions — union preserves them.

The one case union gets wrong: **same line, both sides edited differently** (e.g., one side flipped a ticket status from TO DO → SHIPPED, other side updated the description). Union leaves both lines side-by-side; the human picks one. That's why Step 4 surfaces near-duplicates instead of silently committing.

## Notes

- Never auto-commit. The user reviews `git diff --cached` and commits with `/git-acp` or by hand.
- If `git merge-file --union` reports an error (rare — usually means the file isn't actually conflicted at the index level), surface the error and stop on that file, continue with the rest.
- For non-markdown files in the vault (rare), still applies — union just concatenates text. If the user has YAML frontmatter or JSON in conflict, they'll need to hand-merge; flag it.
- Alternative for files that are ALWAYS append-only (like `wiki/log.md`): add a `.gitattributes` entry `wiki/log.md merge=union` to make git auto-resolve at merge/stash-apply time without needing this command. This command is the catch-all for everything else.
