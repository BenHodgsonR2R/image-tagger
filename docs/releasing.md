# Releasing

Releases use [Changesets](https://github.com/changesets/changesets) and publish to npm.

> Releases are paused: `.github/workflows/release.yml` only runs when started from the Actions tab. To release automatically, add an `NPM_TOKEN` repository secret and change its trigger to `push` to `main`, as described at the top of the file.

1. In a pull request that changes the published package, run `pnpm changeset`, choose major, minor or patch, and describe the change. Commit the file it creates. For changes that don't affect the package, such as tests or CI, use `pnpm changeset --empty`. CI fails if a package change has no changeset.
2. When changesets reach `main`, the release workflow opens a "Version Packages" pull request that bumps `version`, updates `CHANGELOG.md` and removes the changesets.
3. Merging it publishes to npm, tags the release and creates a GitHub release.

## CI on the Version Packages pull request

The pull request is opened with the workflow's `GITHUB_TOKEN`, and GitHub doesn't run workflows on pull requests opened that way. If branch protection requires checks, close and reopen the pull request, or push a commit to it, to start CI.

## Repository settings

Settings → Actions → General: turn on "Allow GitHub Actions to create and approve pull requests", so the release workflow can open the Version Packages pull request.
