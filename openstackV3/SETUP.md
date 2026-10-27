# Infomaniak deployment checklist

Use the canonical [Get started guide](../docs/QUICKSTART.md) for the complete
cloud-first workflow. Commands run from `openstackV3`.

1. Install dependencies and run `pnpm run doctor -- --json`.
2. Run `pnpm run context -- create my-cloud --use`. Add that cloud's downloaded
   service-user configuration at `contexts/my-cloud/credentials/clouds.yaml`.
3. Run `pnpm run setup`, then `pnpm run discover`. Configure the generated
   `contexts/my-cloud/heat/production.yaml` and
   `contexts/my-cloud/router/config.yaml` with your resources and domains.
4. Store a restricted DNS token with `pnpm run dns-token`.
5. Review the target, domain ownership, and costs. Run `pnpm run check`,
   `pnpm run doctor -- --cloud`, then `pnpm run apply -- my-cloud`.
6. On the first deployment, complete the child DNS delegation. Rerun the same
   `apply`, then `pnpm run verify -- my-cloud --json`.
7. After verification passes, [publish and deploy your app](../docs/FIRST-APP.md).

`apply` uses the selected context's environment automatically. The advanced
`deploy` command creates Heat resources only and does not configure a complete
application platform.

For account permissions, configuration examples, DNS ownership and importing
the admin browser certificate, use the [detailed production guide](../docs/DEPLOYMENT.md).
For subsequent changes, follow [operations](../docs/OPERATIONS.md).
