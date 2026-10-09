# Post or update the living PR review comment

Loaded by pr-review Step 9.5 only when `--comment` is passed in PR mode (review-cycle uses it too).

```bash
# 1. Find YOUR existing marker-tracked comment (empty string if none — the `// empty`
#    ensures no literal "null" is returned when there's no match)
ME=$(gh api user --jq .login)
COMMENT_ID=$(gh api "repos/{owner}/{repo}/issues/{pr}/comments" --paginate \
  --jq "first(.[] | select(.user.login == \"$ME\" and (.body | startswith(\"<!-- pr-review -->\"))) | .id) // empty")

if [ -n "$COMMENT_ID" ]; then
  # 2a. Update it in place…
  gh api -X PATCH "repos/{owner}/{repo}/issues/comments/$COMMENT_ID" -F body=@"{review-file}"
else
  # 2b. …or create it if none exists
  gh pr comment {pr} --body-file "{review-file}"
fi
```

Never use `gh pr comment --edit-last` — it edits the user's most recent comment on the PR, which may not be the review.

**Match on author as well as the marker.** Anyone else who runs this skill leaves the same `<!-- pr-review -->` marker, most often the PR author's own self-review. A marker-only lookup finds their comment first, and when your token can edit it (repo admin) the PATCH silently overwrites their review with yours. It happened on a teammate's PR; recovering meant pulling the original body out of GitHub's edit history. If the only marker comment belongs to someone else, create your own.
