# From source to your first live app

This guide deploys a frontend and a Node HTTP API as one stateless service.
Start after [provisioning and verifying your cloud platform](QUICKSTART.md).
An optional [local preview](LOCAL-STARTER.md) lets you explore the sample app.
Commands run in `openstackV3` unless a step says otherwise.

## Bring an existing app

Keep your source where it is. From your application repository, using a
verified TOAD platform and an authenticated registry:

```sh
node /path/to/TOAD-infra/toad.mjs init my-app --project . --image ghcr.io/YOUR-OWNER/my-app:v1 --port 3000 --files Dockerfile,server.mjs
node /path/to/TOAD-infra/toad.mjs app validate my-app --project .
node /path/to/TOAD-infra/toad.mjs app release my-app --project . --context my-cloud
```

List every required build file explicitly; the example above is for a small
Node app. Init preserves existing source and refuses existing TOAD metadata.
Review `toad.yaml`, `compose.toad.yaml` and `build.yaml` before publication.
The generated image is a routing placeholder until the first successful build.
Registry/image/platform defaults persist in `build.yaml`, so later releases
can reuse the same command. Images stay pinned by digest even when a tag is
reused. Private registry pull authentication must still exist on the nodes.

If CI already published an image, pass its full `REGISTRY/APP@sha256:...`
reference to init, then run `app deploy my-app --project . --context my-cloud`.
No local build is required. The existing sample workflow follows below.

## 1. Check your workstation and target

```sh
pnpm install --frozen-lockfile
pnpm run doctor -- --json
pnpm run context -- current --json
pnpm run maintenance -- status --json
```

Use a dedicated context for each client. Confirm that it is the intended
platform. Docker must support Buildx; the starter targets `linux/amd64` by
default. Select `--platform linux/arm64` only for an ARM platform.

## 2. Create and customize

```sh
pnpm run app -- create my-app --template node-web
```

Source is in `apps/my-app/source/`, next to `toad.yaml`, Compose, and
`build.yaml`. Customize the page, stylesheet, and API. Add new source files
to the build allow-list. Credentials, dotenv files, keys, and paths outside
`source/` are rejected. The initial Compose runs a routing placeholder;
publishing replaces it with your app image and port.

Preview your copy from the repository root:

```sh
HOST=127.0.0.1 node apps/my-app/source/server.mjs
```

## 3. Authenticate and publish

<!-- TOAD_LESSON: release -->

Create a registry repository you control. Authenticate Docker using the
registry's credential manager; see the
[official GHCR guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
Never put registry tokens in Compose, build arguments, source, or Git.

```sh
pnpm run app -- publish my-app --image ghcr.io/YOUR-OWNER/my-app:v1
```

This stages only allow-listed source, builds and pushes with Docker Buildx,
reads the registry digest from metadata, and pins it in Compose. Failed builds
leave Compose unchanged. Publishing does not deploy or change DNS. Multi-service
manifests require `--service NAME`.

Public images must permit anonymous pulls. Private-registry pull authentication
must already be configured on Swarm; publishing does not distribute your
workstation's registry credentials.

## 4. Validate, deploy, and open

<!-- TOAD_LESSON: evidence -->

```sh
pnpm run check
pnpm run app -- validate my-app
pnpm run app -- deploy my-app
pnpm run app -- diagnose my-app --json
```

Open `https://my-app.YOUR-PLATFORM-DOMAIN/`. Success means two running replicas
and successful HTTPS checks. Verify `/api/health` and `/api/info` too.
Existing limits, rollback, file allow-list, secret, and volume policies apply.

## 5. Update and roll back

Change the source, then publish a different tag:

```sh
pnpm run app -- publish my-app --image ghcr.io/YOUR-OWNER/my-app:v2
pnpm run app -- validate my-app
pnpm run app -- deploy my-app
pnpm run app -- diagnose my-app --json
```

The container health check detects an unhealthy update; Swarm's update policy
requests rollback on failure. To request rollback explicitly:

```sh
pnpm run app -- rollback my-app
pnpm run app -- diagnose my-app --json
```

Rollback verifies the recovered service and running-task digests and HTTPS
checks, then writes a uniquely named Compose patch without editing your source
or Git. Review and apply that patch from the reported base directory before
deploying again, or the next deployment requests the bad image. Inspect failed
tasks and `app logs my-app --follow --since 15m --tail 100` before retrying.

## 6. Add a secret when your app needs one

The starter accepts `API_TOKEN_FILE` for `/api/private`. Without a configured
token this endpoint returns 401. Keep `/api/health` public.

Declare a secret in `toad.yaml`:

```yaml
secrets:
  - name: api-token
    source: secrets/api-token.age
    environment: API_TOKEN_SECRET
```

Add this to your service in Compose:

```yaml
environment:
  API_TOKEN_FILE: /run/secrets/api-token
secrets:
  - api-token
```

And add the top-level Compose declaration:

```yaml
secrets:
  api-token:
    external: true
    name: ${API_TOKEN_SECRET}
```

Use a protected local file from your password manager, not a literal in a
command or a tracked file:

```sh
pnpm run app -- secret init
pnpm run app -- secret encrypt my-app api-token --from-file /secure/path/api-token
pnpm run app -- validate my-app
pnpm run app -- deploy my-app
pnpm run app -- diagnose my-app --json
```

Only age ciphertext belongs in Git. Back up the age identity separately.
The deployment creates an immutable Swarm secret and mounts it as a file.

## Follow the operation

Use `operation status --json` and `operation history --json` in the same
explicit context to see stages and worker ownership. `observe --app my-app
--output /private/path/view.html --watch` produces a private visual view from
the same evidence an agent sees. See [understand operations](OBSERVABILITY.md).

## CI and reviewable deployment

The manually triggered **Starter application image** workflow builds
`examples/node-web`, publishes `ghcr.io/OWNER/toad-starter`, and records its
digest, SBOM, and provenance. Package visibility is managed separately in
GitHub; a new package is not automatically publicly pullable.

For your own repository, keep build/push separate from deployment. Propose
the returned digest in a TOAD manifest change, validate and review it, then
deploy from the intended operator context. Do not give application build jobs
cloud credentials, SSH private keys, or an admin CA.
