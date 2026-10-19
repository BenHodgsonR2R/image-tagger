# Changesets

Every pull request that changes the published package needs a changeset: a short note saying what changed and whether it's a major, minor or patch change. Add one with:

```bash
pnpm changeset
```

For changes that don't affect the package, such as tests or CI, add an empty one with `pnpm changeset --empty`.

When changesets reach `main`, a bot opens a "Version Packages" pull request that bumps the version and updates `CHANGELOG.md`. Merging that pull request publishes the package.
