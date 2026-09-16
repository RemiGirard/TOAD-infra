# Releases

TOAD uses Conventional Commit squash titles and Release Please. Pull request
titles must use `type(scope): summary`; a breaking release adds `!`, for example
`feat(app)!: change the manifest schema`.

Release-relevant types are:

- `fix` for a SemVer patch;
- `feat` for a SemVer minor;
- any valid type with `!` or a `BREAKING CHANGE:` footer for a SemVer major.

On every push to `main`, Release Please creates or updates a release pull
request containing the calculated version and changelog. Merging that pull
request creates the `vMAJOR.MINOR.PATCH` GitHub release and invokes the reusable
image workflow. The workflow publishes the OCI image with SBOM and provenance,
then signs its immutable digest with keyless Cosign.

If artifact publication fails after the GitHub release and tag exist, rerun the
`Signed operator image` workflow from the Actions page and provide the existing
tag (for example, `v1.1.0`) as `ref`. This recovery path is idempotent and does
not create a replacement version or tag.

The release pull request updates both `version.txt` and
`openstackV3/package.json`. Do not edit either version manually. Manual `v*`
tags remain supported for recovery, but the normal path is the generated pull
request.

The release manifest was bootstrapped at `1.0.0` from the initial commit.
Subsequent releases calculate their version from Conventional Commits after the
latest release tag.

Examples:

```text
feat(context): isolate client operator state
fix(backup): verify an archive before restore
docs(storage): document Cinder tradeoffs
feat(manifest)!: require an explicit persistence profile
```
