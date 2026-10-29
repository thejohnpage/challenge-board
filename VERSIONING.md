# Challenge Board versioning

The **only authoritative version** is `package.json` (`version`).
`src/app/generated/app-version.ts` is derived at build time and is used by the footer.

## Local setup
Run `npm install` and `npm run prepare` after pulling changes.
Husky installs the local Git `commit-msg` hook. GitHub web edits and API commits
**do not run local Git hooks**; update the version explicitly for those commits.

## Automatic local Git commit versioning
When you commit locally:
- `[MAJOR] ...` increments **major** and resets minor/patch
- `[MINOR] ...` increments **minor** and resets patch
- `[PATCH] ...` increments **patch**
- `feat: ...` increments **minor** (0.1.0 → 0.2.0)
- `fix: ...`, `refactor: ...` and other messages increment **patch**
- `feat!: ...` or a `BREAKING CHANGE:` footer increments **major**
- docs-only commits and merge commits are skipped

The hook updates `package.json`, the lockfile root version, and the generated
Angular version constant and stages them into the same commit.

Example:
```bash
git add .
git commit -m "feat: add team login"
git push
```

`npm run build` regenerates the constant from package.json before compiling.
No need to edit the footer manually. Copyright year is computed at runtime.

Note: Husky is a Git hook manager, not a VS Code Git extension. GitLens or Git
Graph may be used for visualization but are not required for versioning.
