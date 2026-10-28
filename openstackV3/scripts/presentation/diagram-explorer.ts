import { renderEvolvingMap } from './evolving-map.js';
import { diagramSteps } from './diagram-depth.js';

/** Public teaching content: one scene, progressively revealed by a native range. */
export function renderDiagramExplorer(expertHtml: string): string {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const sections = [...expertHtml.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  if (sections.length !== 6) throw new Error('Review the six expert implementation sections before embedding.');
  const expert = sections.map((match, index) => {
    // The scene already shows topology. The separate static map stays in the full guide.
    const body = expertHtml.slice(match.index! + match[0].length, sections[index + 1]?.index ?? expertHtml.length)
      .replace(/<p><span class="implementation-figure">[\s\S]*?<\/p>/, '');
    return `<details class="expert-chapter" id="expert-${match[1]}"><summary>${match[2]}</summary><div class="expert-chapter-body">${body}</div></details>`;
  }).join('');
  return `<div class="diagram-explorer" data-diagram-explorer>
<figure class="evolving-figure">
<div class="detail-controls" data-level-controls hidden>
<div class="detail-control-heading"><label for="diagram-detail">Turn up the detail</label><output for="diagram-detail" aria-live="off" data-level-status>06 / 10 · Swarm</output></div>
<input id="diagram-detail" type="range" min="0" max="100" step="1" value="60" aria-describedby="detail-hint" aria-valuetext="Step 6 of 10: Swarm" data-detail-slider>
<div class="detail-stops" role="group" aria-label="Jump to a detail step">${diagramSteps.map((step,index)=>`<button type="button" data-detail-stop="${step.at}" data-step-key="${step.key}" data-step-name="${escape(step.name)}" data-step-title="${escape(step.title)}" data-step-description="${escape(step.description)}" aria-label="Step ${index+1}: ${escape(step.name)}" title="${escape(step.name)}"><span class="detail-stop-number">${index+1}</span><span class="detail-stop-name">${escape(step.name)}</span></button>`).join('')}</div>
<p id="detail-hint">One map. Ten steps, from a link to the full infrastructure.</p>
</div>
<div class="map-tools" data-map-tools hidden><div class="map-zoom" role="group" aria-label="Diagram zoom"><button type="button" data-zoom-out aria-label="Zoom out">−</button><button type="button" data-zoom-fit aria-label="Fit diagram to viewport">Fit</button><button type="button" data-zoom-in aria-label="Zoom in">+</button><output aria-live="off" data-zoom-label>100%</output></div><button type="button" data-view-step hidden>View this step ↓</button><button type="button" data-view-overview hidden>Overview ↑</button></div>
<div class="evolving-viewport" tabindex="0" role="region" aria-label="Your app diagram; scroll to explore the full map" data-map-viewport>
${renderEvolvingMap()}
<picture data-static-overview><source media="(max-width:760px)" srcset="/global-map-mobile.svg" width="360" height="1570"><img src="/global-map.svg" width="1120" height="860" alt="You and your agent use TOAD to prepare your cloud and deploy an app. Visitors use DNS and HTTPS. Monitoring brings evidence back." loading="lazy"></picture>
</div>
<figcaption><div><strong data-scene-title>Your platform, end to end.</strong><p data-scene-description>Your source, local CLI, registry, cloud account, public app and private monitoring. The current profile uses three managers.</p></div><a href="/?level=toad#whole-picture" data-level-link hidden>Link to this view ↗</a></figcaption>
<p class="map-model-note">Teaching model · no cloud access · public IPs are examples · <a href="/implementation.html">Reviewed implementation &amp; sources</a> · <a href="/lucide-LICENSE.txt">Icon notices</a></p>
</figure>
<details class="expert-notes"><summary>Read the implementation details <span>6 chapters · exact behavior · source links</span></summary><div class="expert-toolbar"><button type="button" data-expand-expert aria-expanded="false" hidden>Expand all details</button><a href="/implementation.html">Open the full guide ↗</a></div><div class="expert-content doc-content">${expert}</div></details>
<noscript><p class="diagram-nojs">Static views: <a href="/diagram-simple.svg">Just the idea</a> · <a href="/diagram-web.svg">Web basics</a> · <a href="/implementation.html">Expert implementation</a>. The TOAD overview above works without JavaScript.</p></noscript>
</div>`;
}
