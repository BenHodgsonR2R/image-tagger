# Releasing

Releases use [Changesets](https://github.com/changesets/changesets) and publish `@bhodgson/image-tagger` to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers): npm trusts `.github/workflows/release.yml`, so no npm token is stored anywhere, and each version gets a provenance statement linking it to the commit that built it.

1. In a pull request that changes the published package, run `pnpm changeset`, choose major, minor or patch, and describe the change. Commit the file it creates. For changes that don't affect the package, such as tests or CI, use `pnpm changeset --empty`. CI fails if a package change has no changeset.
2. When changesets reach `main`, the release workflow opens a "chore(release): version packages" pull request that bumps `version`, updates `CHANGELOG.md` and removes the changesets. GitHub doesn't run CI on pull requests the workflow opens, so close and reopen it to start the required checks.
3. Merging it publishes to npm, tags the release and creates a GitHub release.
