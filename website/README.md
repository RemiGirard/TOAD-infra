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

The landing page and visual architecture guide use the original responsive
`delivery{,-mobile}.svg` and `platform{,-mobile}.svg` illustrations. Their
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
