# Releasing

Releases use [Changesets](https://github.com/changesets/changesets) and publish `@bhodgson/image-tagger` to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers): npm trusts `.github/workflows/release.yml`, so no npm token is stored anywhere, and each version gets a provenance statement linking it to the commit that built it.

## Each release

1. In a pull request that changes the published package, run `pnpm changeset`, choose major, minor or patch, and describe the change. Commit the file it creates. For changes that don't affect the package, such as tests or CI, use `pnpm changeset --empty`. CI fails if a package change has no changeset.
2. When changesets reach `main`, the release workflow opens a "Version Packages" pull request that bumps `version`, updates `CHANGELOG.md` and removes the changesets.
3. Merging it publishes to npm, tags the release and creates a GitHub release. If npm holds the version for review, approve it with 2FA in the Staged Packages tab on npmjs.com, or with `pnpm stage approve <stage-id>` (`pnpm stage list` shows the ID).

## One-time setup

1. **Publish the first version by hand**, so the package exists on npm. Log in as an owner of the `@bhodgson` org, then from a clean checkout of `main`:

   ```bash
   npm login
   pnpm install && pnpm build && pnpm check:package
   pnpm publish
   ```

2. **Add the trusted publisher** before merging the first Version Packages pull request, on npmjs.com: the package's Settings → Trusted Publisher → GitHub Actions, with owner `BenHodgsonR2R`, repository `image-tagger` and workflow `release.yml`. npm discards the setting if nothing publishes through it within 2 days, so add it just before merging.
3. **Disallow tokens**: in the same settings, set Publishing access to require two-factor authentication and disallow tokens. Trusted publishing still works.
4. **Allow the Version Packages pull request**: in GitHub, Settings → Actions → General, turn on "Allow GitHub Actions to create and approve pull requests".

## CI on the Version Packages pull request

The pull request is opened with the workflow's `GITHUB_TOKEN`, and GitHub doesn't run workflows on pull requests opened that way. If branch protection requires checks, close and reopen the pull request, or push a commit to it, to start CI.
