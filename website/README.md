# Public TOAD site

Source lives here; documentation comes from the explicit list in
`openstackV3/scripts/site-build.ts`. No operator configuration or credentials
are read by the build. Only reviewed, tracked Markdown and explicitly named
teaching fragments are rendered. Other raw Markdown HTML is escaped, and the
deployed site has a restrictive Content Security Policy.

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

## Positioning

Lead with user control: the provider account, infrastructure definitions,
application source and operation workflow. Heat, Ansible and Compose are
inspectable files; the local CLI makes them one workflow for people and agents.
The ownership section provides concrete evidence before the teaching map.

Free means the current MIT-licensed TOAD software can be used and modified;
cloud resources and chosen services still cost money. The hardware is rented.
The current complete workflow is verified on Infomaniak, and other providers
need adaptation. Account setup and first DNS delegation include human steps.
Keep operator access private; platform and app services receive declared
secrets in the cluster. Ownership also includes upkeep and recovery.

## Diagrams

The global overview in [Your app explained](../docs/UNDERSTAND.md) connects
code, agent, TOAD, registry, cloud servers, the visitor, DNS, HTTPS, app and
read-only monitoring in one picture. It uses real Lucide pictograms and the
existing TOAD mascot. Green delivery arrows, blue request arrows, dotted DNS
lookup arrows and purple observation arrows have separate meanings.
`openstackV3/scripts/presentation/overview.ts` generates desktop and mobile SVGs during
the site build; the copies in this folder also render in GitHub Markdown.
Icon sources are pinned in `vendor/lucide/`; their full ISC / Feather MIT
notices are embedded in every generated SVG and included as a public text asset.
The diagram is illustrative and makes no infrastructure requests. SVG
presentation attributes keep both image embeds and standalone diagrams
compatible with the deployed Content Security Policy, without inline CSS.

The homepage has one evolving SVG scene, rendered by `presentation/evolving-map.ts`.
A native difficulty range reveals DNS and HTTPS, then TOAD delivery and cloud
resources, then technical addresses and boundaries. The same device, Internet
and app nodes persist throughout. Four named stops are available: **Just the
idea**, **Web basics**, **TOAD platform** (the default), and **Expert**.
`diagram-levels.mjs` gently interpolates SVG attributes and makes room before
fading in new parts; it does not replace diagrams or inject inline styles.
Motion stops when settled or hidden, and honors reduced-motion preferences.
The mobile layout follows the same scene vertically in a scrollable viewport.
Native keyboard controls work, and the URL shares both named levels
(`?level=web#whole-picture`) and intermediate detail (`?level=web&detail=42#whole-picture`).
Range adjustments are coalesced into history entries; Back/Forward restore the scene.

The optional implementation notes reuse `IMPLEMENTATION.md` in six expandable
chapters, with source links and explicit failure boundaries. Its separate static
topology stays in the standalone guide. Keep the six-section embedding contract
in `presentation/diagram-explorer.ts` aligned when editing that guide.
Without JavaScript, the default static map and links to the other diagrams/guide
remain available. These are teaching models, never live observations; the simple
view does not promise a one-server TOAD profile.

The quickstart, complete Infomaniak example, account, first-app and observation
guides embed the reviewed HTML teaching diagrams in `lessons/` using exact
`TOAD_LESSON` comments. The build accepts only the named fragments in those
five documents; all other raw Markdown HTML
remains escaped. `lessons.css` lays them out for desktop and mobile, and
`lessons.mjs` lets readers follow a browser request through DNS, HTTPS and the
app. Playback starts on request and pauses when the page is hidden. Nothing
connects to a cloud. Without JavaScript, the complete route and inline diagrams
remain visible. Keep the Markdown's surrounding explanations useful on GitHub,
where the visual comments do not render.

The homepage shows the global overview before its optional parts explorer.
The explorer starts with the current three-server profile; the proposed IPv6
profile is a separate choice. Setup, app, cost and teaching cards reuse
`teaching-icons.svg` through reviewed `TOAD_ICON` markers. The sprite carries
the complete upstream notices, needs no JavaScript or third-party requests,
and its icons are decorative: text labels remain available to screen readers.
`visuals.css` controls their sizes and layout. The same `my-app` example joins
the homepage, runnable guides and public monitoring fixture. Recorded deployment
evidence retains its original names.

The homepage's `learn.css` / `learn.mjs` teaching map introduces domains,
DNS, cloud servers, load balancing, TLS, containers and persistent data before
the technical workflow. It never reads private infrastructure. The static
`app-map{,-mobile}.svg` pair remains available as a smaller visitor-path
illustration. DNS lookup is separate from the
HTTPS route; Octavia passes TCP through and TLS terminates at Traefik.
The private operation renderer shows a labelled route model beside actual
observed server/application cards, without inventing placement or health.

The hosting comparison describes responsibility and workflow, not price or
feature superiority. Its Render, Railway and Coolify references were checked
on 28 October 2026; keep primary-source links next to the comparison.

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

Copy the terminal command or the minimal agent request. The request contains
one sentence and TOAD-infra's repository URL. The repository's AGENTS.md and
agent runbook own the operating context, account hand-offs, plan review and
verification; there is no separate expanded-prompt flow. The three request
files remain canonical and the build embeds their escaped text. Clipboard
copying makes no network request. Deployment-task copying remains the original
request even while the hero plays a later conversation step.

The account guide covers access; the complete Infomaniak example covers the
project, public/private IPs, DNS, HTTPS, app release and monitoring. The setup
builder lets visitors see what each stage creates. Reserved documentation
addresses are examples, not discovered resources. Other OpenStack providers
still require compatibility review.

The monitoring area uses the same renderer and client as private observation
exports, in openstackV3/scripts/presentation/monitoring. Public data comes only
from its explicit example fixture. Tabs, server details and scenario selection
work; public controls do not connect to infrastructure or execute mutations.
The recorded release excerpts stay in an expandable monitoring-incident panel.
They are historical evidence, separate from the interactive example states.

The cost estimator starts with the provider's one-node IPv6 design and links
the configured estimate. This is not an implemented TOAD starter profile.
The current complete deployment is still three managers. Rates and support
status are documented in docs/COSTS.md, including the router gateway IPv4.
Time, instance rate and topology choices update an itemized estimate; they do
not perform resizing or imply automatic node migration.

## Agent content references

Reviewed 28 October 2026. The copy is original; these official pages informed
the organization of the content:

- [Render for Agents](https://render.com/agents) and
  [coding-agent docs](https://render.com/docs/llm-support): a short starting
  request, followed by deployment, debugging and health-check examples.
- [Railway for Agents](https://docs.railway.com/agents): explain how the agent
  gets platform access and distinguish the available interfaces. TOAD's
  current examples use its local CLI and operator context.
- [Vercel Agent Resources](https://vercel.com/docs/agent-resources): provide
  task workflows and direct machine-readable context alongside human docs.
