# Releases And Versioning

Training Communications Studio uses SemVer-style application versions:

- Patch: fixes that do not change expected workflows.
- Minor: new features, installer improvements, or backwards-compatible workflow changes.
- Major: breaking data, configuration, or operational changes.

## Branch Rules

- Do not commit directly to `main`.
- Create a focused branch for each change.
- Open a pull request into `main`.
- Keep `main` releasable.

## Local Release Checklist

Before tagging a release:

```bash
npm run agent:check
npm run desktop:build
```

`npm run desktop:build` creates an unpacked local desktop package. Full
installer artifacts are built by the release workflow.

## Creating A Release

1. Update `package.json` and `package-lock.json` with the new version. Prefer:

   ```bash
   npm version 0.1.0 --no-git-tag-version
   ```

2. Commit the version change through a pull request.
3. After the PR merges, create and push a matching tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. The release workflow builds desktop packages for Windows, macOS, and Linux.
5. The GitHub release is created as a draft so artifacts can be reviewed before
   publishing.

Manual release workflow runs must point at an existing reviewed tag. The
workflow validates that the requested tag exists and that it matches
`package.json`.

## Required Repository Rules

The `main` branch should require pull requests and these status checks before
merge:

- `App gate`
- `SonarCloud Code Analysis`

Release tags should be created only after the version PR has merged.

## Desktop Targets

- Windows: NSIS installer.
- macOS: DMG.
- Linux: AppImage and Debian package.

Unsigned desktop builds may show operating-system warnings. Signing and
notarization can be added after the first public release path is stable.
