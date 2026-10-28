# Licensing scope

## Current TOAD distribution

TOAD's own code, documentation, diagrams, and starter examples in the current
repository are distributed under the [MIT license](LICENSE), with Remi Girard
as the copyright holder. This permits commercial and proprietary reuse,
including use and modification by coding agents. Copies or substantial
portions must retain the copyright and permission notice in `LICENSE`.

The root license grants rights to TOAD material that Remi Girard is entitled
to license. It does not replace separately identified third-party terms.
The starter template includes a copy of the MIT notice so it accompanies
copied source and newly built starter images.

## Earlier revisions and releases

This change applies to the current repository distribution carrying the MIT
notice. It does not rewrite Git history, relabel existing releases or images,
or automatically relicense every historical commit. Earlier distributions
retain their accompanying license notices, including AGPL-3.0-or-later where
applicable. A separate MIT grant for a specific historical revision must be
established independently; this change does not provide one.

## Separately licensed components

Dependencies, tools, container base images, and services used or distributed
with TOAD retain their own licenses and notices. The TOAD MIT declaration in
package metadata and OCI labels describes TOAD's material, not every component
of an image or deployment.

For example, the direct JavaScript dependencies declare ISC (`yaml`), MIT
(`marked`, `tsx`, and `@types/node`), and Apache-2.0 (`typescript`). Installed
Python and operating-system packages, Node/Debian base images, GitHub Actions,
and external service images also have independent terms. Consult each pinned
component's distribution and notices; this is not an exhaustive dependency
license inventory. Preserve upstream notices when redistributing them.

The global overview's pictograms in `website/vendor/lucide/` are separately
licensed Lucide icons, including Feather-derived icons. Their complete ISC
and Feather MIT notices are retained in that directory's `LICENSE`, embedded
in the standalone overview SVGs, and distributed as `website/lucide-LICENSE.txt`
with the public site. The surrounding TOAD illustration remains MIT.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the terms of new contributions.
