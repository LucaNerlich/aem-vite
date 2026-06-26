---
name: aemvite-release
description: Full release automation for the @aemvite monorepo — bumps all six package versions in unison, updates cross-dependency ranges, updates changelogs (root + per-package), updates version references in README.md and MIGRATION.md, commits, tags, pushes, and creates a GitHub release. Use this skill whenever the user says "release", "bump version", "cut a release", "new version", "tag a release", "prep a release", "ship it", or asks to publish the aemvite packages. Also trigger when the user mentions semver, changelog, or version bump in the context of this monorepo.
---

# aemvite-release

Full release automation for the `@aemvite/*` monorepo. All six packages always move to the same version in one shot — this matches how CI publishes them (atomically, on a single `v*` tag).

## Packages released (unified versioning)

| Package | Path |
|---|---|
| `@aemvite/aem-config` | `packages/aem-config/` |
| `@aemvite/vite-plugin-aem-clientlib` | `packages/vite-plugin-aem-clientlib/` |
| `@aemvite/vite-plugin-glob` | `packages/vite-plugin-glob/` |
| `@aemvite/vite-plugin-aem-resources` | `packages/vite-plugin-aem-resources/` |
| `@aemvite/vite-plugin-aem-css-url-passthrough` | `packages/vite-plugin-aem-css-url-passthrough/` |
| `@aemvite/vite-plugin-aem-handlebars` | `packages/vite-plugin-aem-handlebars/` |

---

## Step 1 — Safety check

```bash
git status --short
```

If there are uncommitted changes that are **not** part of the release (e.g. in-progress source edits), stop and tell the user. Ask whether to stash, include, or abort. Do not proceed with a dirty tree unless the user explicitly says to.

---

## Step 2 — Current state snapshot

Read the current version from each package:

```bash
node -p "require('./packages/aem-config/package.json').version"
node -p "require('./packages/vite-plugin-aem-clientlib/package.json').version"
node -p "require('./packages/vite-plugin-glob/package.json').version"
node -p "require('./packages/vite-plugin-aem-resources/package.json').version"
node -p "require('./packages/vite-plugin-aem-css-url-passthrough/package.json').version"
node -p "require('./packages/vite-plugin-aem-handlebars/package.json').version"
```

Find the last release tag and collect commits since then:

```bash
LAST_TAG=$(git describe --tags --abbrev=0 --match="v*" 2>/dev/null || echo "no-previous-tag")
echo "Last tag: $LAST_TAG"
git log ${LAST_TAG}..HEAD --oneline --no-merges
```

If there is no previous tag, use the full commit log.

---

## Step 3 — Decide the version bump

Categorise the commits into:
- **Breaking changes** — anything that removes or changes a public API in a non-backwards-compatible way
- **Features / enhancements** — new behaviour, new config options, new exports
- **Fixes / chores / docs** — corrections, dependency bumps, CI tweaks, refactors, docs

Apply these rules to determine the bump level:

| Commits contain | Bump |
|---|---|
| Any breaking change | **minor** (project is pre-1.0; minor is the pre-1.0 equivalent of major) |
| At least one feature | **minor** |
| Only fixes, chores, or docs | **patch** |

If the user has explicitly requested a bump level (`patch`, `minor`, `major`), honour their request.

Show the user the proposed bump level and the new version string and **confirm before proceeding**. This is a destructive operation (git tags are hard to undo once pushed); always get explicit approval.

---

## Step 4 — Bump all six `package.json` versions

**Important:** Do NOT use `npm version` at the workspace root — the `pnpm` shim intercepts it and behaves incorrectly (see CLAUDE.md). Instead, `cd` into each package directory separately:

```bash
# If the working tree is dirty (changes included in the release commit),
# add --force to bypass npm's git-state check.
(cd packages/aem-config                       && npm version <bump> --no-git-tag-version --force)
(cd packages/vite-plugin-aem-clientlib         && npm version <bump> --no-git-tag-version --force)
(cd packages/vite-plugin-glob                  && npm version <bump> --no-git-tag-version --force)
(cd packages/vite-plugin-aem-resources         && npm version <bump> --no-git-tag-version --force)
(cd packages/vite-plugin-aem-css-url-passthrough && npm version <bump> --no-git-tag-version --force)
(cd packages/vite-plugin-aem-handlebars          && npm version <bump> --no-git-tag-version --force)
```

> **Note:** `--no-git-tag-version` alone is not enough when the tree is dirty — npm still exits non-zero. `--force` suppresses that check; it is safe here because we never let npm create a tag (the skill handles tagging explicitly in Step 9).
>
> **Fallback:** If `npm version` continues to fail (e.g. pnpm shim interference), edit the `"version"` field in each `package.json` directly with the Edit tool — it is equivalent and always reliable.

Verify that all six files now show the new version:

```bash
grep '"version"' packages/*/package.json
```

---

## Step 5 — Update cross-package dependency ranges

### `packages/aem-config/package.json` — plugin deps

`packages/aem-config/package.json` declares all five plugin packages as `dependencies`. Update all their version ranges to `^<new-version>`:

```json
"@aemvite/vite-plugin-aem-clientlib": "^<new-version>",
"@aemvite/vite-plugin-aem-css-url-passthrough": "^<new-version>",
"@aemvite/vite-plugin-aem-handlebars": "^<new-version>",
"@aemvite/vite-plugin-aem-resources": "^<new-version>",
"@aemvite/vite-plugin-glob": "^<new-version>",
```

### `aemviteexample/ui.frontend/package.json` — reference consumer

This is the second example consumer (installs `@aemvite/aem-config` as a real npm version, not via `file:`). Update its `devDependencies` entry:

```json
"@aemvite/aem-config": "^<new-version>",
```

> `aemvite/ui.frontend/package.json` uses `file:` links and has no version number — leave it untouched.

---

## Step 6 — Update changelogs

### Root `CHANGELOG.md`

Prepend a new section immediately after the `# Changelog` header line, following the existing style:

```markdown
## [<new-version>] - <YYYY-MM-DD>

### Added
- <feature descriptions>

### Fixed
- <bugfix descriptions>

### Changed
- <other notable changes>
```

Rules:
- Use today's date (`date +%Y-%m-%d`).
- Only include sections that have entries — omit empty sections.
- Write from the user's perspective ("Added support for X", not "Implemented X in module Y").
- Group related commits into one entry rather than listing every commit verbatim.

### Per-package `CHANGELOG.md` files

Update each of the five per-package changelogs with a matching entry. Attribute commits to packages where it is clear (e.g. a fix in `vite-plugin-glob/` goes only in that package's changelog). For changes that span multiple packages, include the entry in all relevant package changelogs. Preserve the existing style in each file.

Per-package changelog paths:
- `packages/aem-config/CHANGELOG.md`
- `packages/vite-plugin-aem-clientlib/CHANGELOG.md`
- `packages/vite-plugin-glob/CHANGELOG.md`
- `packages/vite-plugin-aem-resources/CHANGELOG.md`
- `packages/vite-plugin-aem-css-url-passthrough/CHANGELOG.md`
- `packages/vite-plugin-aem-handlebars/CHANGELOG.md`

---

## Step 7 — Update version references in documentation

Use `grep -n` to locate the current lines before editing (line numbers drift over time):

```bash
grep -n "aemvite/aem-config" README.md MIGRATION.md
grep -n "0\.[0-9]*\.[0-9]*" README.md | grep -v "^Binary"
```

### `README.md`

1. **Install / adopter example** — the code block showing the recommended `package.json` snippet for consumers. Update `"@aemvite/aem-config": "^<old>"` → `"@aemvite/aem-config": "^<new>"`.

2. **Status / versions table** — typically near the bottom of the README, lists each package and its current version. Update all five package version strings.

### `MIGRATION.md`

1. **"AFTER" migration example** — the code block showing a migrated `package.json`. Update `"@aemvite/aem-config": "^<old>"` → `"@aemvite/aem-config": "^<new>"`.

---

## Step 8 — Commit

Stage all modified files and commit:

```bash
git add \
  packages/aem-config/package.json \
  packages/vite-plugin-aem-clientlib/package.json \
  packages/vite-plugin-glob/package.json \
  packages/vite-plugin-aem-resources/package.json \
  packages/vite-plugin-aem-css-url-passthrough/package.json \
  packages/vite-plugin-aem-handlebars/package.json \
  aemviteexample/ui.frontend/package.json \
  CHANGELOG.md \
  packages/aem-config/CHANGELOG.md \
  packages/vite-plugin-aem-clientlib/CHANGELOG.md \
  packages/vite-plugin-glob/CHANGELOG.md \
  packages/vite-plugin-aem-resources/CHANGELOG.md \
  packages/vite-plugin-aem-css-url-passthrough/CHANGELOG.md \
  packages/vite-plugin-aem-handlebars/CHANGELOG.md \
  README.md \
  MIGRATION.md

git commit -m "chore: release v<new-version>"
```

---

## Step 9 — Tag

Create an annotated tag:

```bash
git tag -a "v<new-version>" -m "v<new-version>"
```

---

## Step 10 — Push

Push the commit and the tag:

```bash
git push && git push --tags
```

If push fails (branch protection, auth, diverged history), stop and report the exact error. Do not force-push. Tell the user what manual action is needed.

---

## Step 11 — Create GitHub release

Extract the changelog entry for this version (the section from `## [<new-version>]` down to, but not including, the next `## [` heading), then create the release:

```bash
gh release create "v<new-version>" \
  --title "v<new-version>" \
  --notes "<changelog section content>"
```

The GitHub release notes should contain exactly the changelog entry written in Step 6 — no more, no less.

---

## Step 12 — Summary

After all steps complete, print:

```
Released v<new-version>
  Bump:       <patch|minor>
  Packages:   aem-config, vite-plugin-aem-clientlib, vite-plugin-glob, vite-plugin-aem-resources, vite-plugin-aem-css-url-passthrough, vite-plugin-aem-handlebars
  Changelogs: root + 6 per-package
  Docs:       README.md, MIGRATION.md
  Commit:     <short-sha>
  Tag:        v<new-version>
  Pushed:     yes
  GH release: <url>
```

---

## Edge cases

- **User requests a specific bump level** — honour it; skip auto-detection.
- **No previous tag** — use full git log; note in changelog that this is the first versioned release.
- **No remote configured** — skip Steps 10–11, inform the user the commit and tag are local only.
- **`gh` CLI not authenticated** — skip Step 11, print the `gh release create` command for the user to run manually.
- **Push fails** — stop immediately, report the error, do not attempt Step 11.
