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
