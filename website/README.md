# Public TOAD site

Source lives here; documentation comes from the explicit list in
`openstackV3/scripts/site-build.ts`. No operator configuration or credentials
are read by the build. Only reviewed, tracked Markdown is rendered. Raw HTML
is escaped, and the deployed site has a restrictive Content Security Policy.

```sh
cd openstackV3
pnpm run site:build
pnpm run app -- validate toad-landing
cd ..
node website/serve.mjs
```

Open the printed loopback URL. Generated deployment files live in
`apps/toad-landing/`; keep them in sync with this build before deployment.
The screenshot is captured from the running starter, not generated API output.

Deployment uses the existing pinned Nginx image and immutable content-hashed
Docker configs, so publishing this static site needs no custom registry image.
Only the exact `toad.remigirard.dev` router is owned by this app. Deploy it
through the intended existing operator context using the normal app lifecycle.
The starter demo is a separate `toad-demo` app routed at `/starter/`.

## Diagrams

The landing page starts with the cloud-first `journey{,-mobile}.svg` overview.
The visual architecture guide then separates `platform{,-mobile}.svg` from
`delivery{,-mobile}.svg` for releases onto an existing platform. All have
responsive layouts. Their
structure follows the deployment and TOAD diagrams in the L’Heure des Comptes
portfolio case study; the wording and colors are specific to this site.

The 11 Mermaid blocks in the reviewed deployment, operations, and recovery
guides are rendered to static SVGs. Horizontal flowcharts also have vertical
mobile layouts. Visitors need no diagram library or third-party request.
Descriptions, expandable source, and full-size links accompany each diagram.
The normal site build checks both source and SVG hashes in `diagrams.json`,
so editing a Mermaid block requires refreshing its images before publication.

To refresh, install the pinned [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli)
in a temporary tooling directory, then run from `openstackV3`:

```sh
pnpm run site:diagrams -- /absolute/path/to/mmdc
pnpm run site:build
```

The renderer must report version `11.12.0`. It uses its own headless browser;
set `TOAD_DIAGRAM_BROWSER` to an installed Chromium executable if needed.
Review changed SVGs, mobile layouts, and the diagram cache before committing.
Normal builds and deployment do not install or launch the renderer.

## Terminal and agent examples

The hero shows a terminal and an agent conversation together, connected by a
playable five-step handoff: plan, inspect, approve, ship and verify. Both remain
visible. The stage buttons also work without playback; playback starts only on
request, can be paused, and stops when the page is hidden. Reduced-motion
preferences disable the decorative movement.

Copy the current terminal command or the full starter prompt. Start from your
own app repository; the prompt names and links TOAD-infra, asks the agent to
inspect your app, reuse existing setup, and explain any cloud requirements and
costs before making changes. No app or context placeholders need filling in.
Expand **Read the full prompt** to review exactly what will be copied.
The canonical text lives in `agent-prompt.txt`; the build escapes and embeds it
in the homepage and publishes the same plain-text file for direct use.
Commands use
the repository's `./toad` launcher after workstation, context and app setup.
`node toad.mjs` remains equivalent on platforms without executable symlinks.
The example represents a coding agent using your local CLI/operator context;
no hosted agent is implied, no credentials belong in chat, and nothing on this
page runs a deployment. Approval happens in the agent conversation, as asked
by the starter brief. Example output is an illustrative excerpt.

The agent section's **release room** plays a six-step story on an existing
platform with a pinned image: inspect, validate, ask for approval, roll out,
check, and report. `app deploy` deploys the reviewed image without rebuilding it.
Playback pauses at the demo approval. Choose a successful release, automatic
rollback, or expired observation; the agent's explanation, terminal excerpt,
infrastructure diagram, and release evidence change together. The old version
remaining healthy never counts as delivery of the requested image.

Play/pause, previous/next, and individual steps support manual exploration.
Playback stops when the room leaves the viewport or the page is hidden, and
starting another player pauses the current one. Reduced-motion preferences
remove decorative animations while preserving the steps and controls. These
stories use illustrative data only; the separate recorded walkthrough keeps
its original evidence and dates.
