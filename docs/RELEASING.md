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

The release pull request updates both `version.txt` and
`openstackV3/package.json`. Do not edit either version manually. Manual `v*`
tags remain supported for recovery, but the normal path is the generated pull
request.

The repository has no historical `v*` tag, so the manifest starts from version
`1.0.0` and records the initial commit as `bootstrap-sha`. The first generated
release will therefore calculate the next version from Conventional Commits
after that point; it does not require fabricating an old release tag.

Examples:

```text
feat(context): isolate client operator state
fix(backup): verify an archive before restore
docs(storage): document Cinder tradeoffs
feat(manifest)!: require an explicit persistence profile
```
