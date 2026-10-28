/** All panels are public teaching content. Switching levels never contacts a cloud. */
const levels = [
  { key: 'simple', label: 'Just the idea', subtitle: 'Zero jargon',
    description: 'Your device asks another computer for a page. The Internet carries the request and the reply. Start with those three things.',
    file: 'diagram-simple', width: 1120, height: 450, mobileHeight: 830,
    alt: 'Your device asks across the Internet for a page. Another computer sends the page back. The cloud symbol represents the Internet network.',
    caption: 'The Internet connects the computers. TOAD helps put your website on the computer that answers.',
    takeaway: 'A website keeps working when your laptop is off because the app runs on another computer.' },
  { key: 'web', label: 'Web basics', subtitle: 'Names, addresses, HTTPS',
    description: 'Add the name people type, the DNS lookup that finds an IP address, and the HTTPS connection that protects the visit.',
    file: 'diagram-web', width: 1120, height: 580, mobileHeight: 1110,
    alt: 'DNS looks up the name and returns an IP. The browser then connects across the Internet over HTTPS to the website computer. DNS does not proxy the page.',
    caption: 'DNS finds the address. HTTPS protects the browser connection. The website computer runs your app.',
    takeaway: 'A domain is a name, an IP is an address, and DNS is the lookup between them.' },
  { key: 'toad', label: 'TOAD platform', subtitle: 'Your cloud, end to end',
    description: 'The complete picture: your source, local CLI, image registry, cloud account, public app and private observations. This is the current three-manager profile.',
    file: 'global-map', width: 1120, height: 860, mobileHeight: 1570,
    alt: 'You and your agent use a local TOAD CLI, editable platform files and a chosen registry. The app runs in your cloud account. Visitors use DNS and HTTPS; monitoring brings evidence back.',
    caption: 'Green: ship · Blue: visit · Dotted: DNS lookup · Purple: observe',
    takeaway: 'TOAD orchestrates infrastructure and app delivery from your environment. You retain the account, code and operational responsibility.' },
] as const;

export function renderDiagramExplorer(expertHtml: string): string {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const sections = [...expertHtml.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  if (sections.length !== 6) throw new Error('Review the six expert implementation sections before embedding.');
  const intro = expertHtml.slice(0, sections[0]!.index).replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/, '');
  const expert = sections.map((match, index) => {
    const body = expertHtml.slice(match.index! + match[0].length, sections[index + 1]?.index ?? expertHtml.length);
    return `<details class="expert-chapter" id="expert-${match[1]}"${index === 0 ? ' open' : ''}><summary>${match[2]}</summary><div class="expert-chapter-body">${body}</div></details>`;
  }).join('');
  const tabs = [...levels.map(({ key, label, subtitle }) => ({ key, label, subtitle })), { key: 'expert', label: 'Expert', subtitle: 'Implementation, ports, trust' }];
  return `<div class="diagram-explorer" data-diagram-explorer data-current-level="toad">
<div class="diagram-level-controls" role="tablist" aria-label="Choose the diagram detail level" hidden data-level-controls>${tabs.map((level, index) => `<button type="button" role="tab" id="diagram-tab-${level.key}" data-diagram-level="${level.key}" aria-label="Level ${index + 1}: ${level.label}" aria-selected="${level.key === 'toad'}" aria-controls="diagram-panel-${level.key}" tabindex="${level.key === 'toad' ? 0 : -1}"><span class="diagram-level-number">0${index + 1}</span><span><strong>${level.label}</strong><small>${level.subtitle}</small></span></button>`).join('')}</div>
<p class="diagram-level-help" data-level-help hidden>Choose your level. Add detail when you want it; use ← / → to switch with a keyboard. <a href="/?level=toad#whole-picture" data-level-link>Link to this view ↗</a></p>
<p class="diagram-level-status" role="status" aria-live="polite" aria-atomic="true" data-level-status>Level 3 of 4 · TOAD platform</p>
${levels.map((level) => `<section class="diagram-panel" id="diagram-panel-${level.key}" role="tabpanel" aria-labelledby="diagram-tab-${level.key}" tabindex="0" data-diagram-panel="${level.key}"${level.key === 'toad' ? '' : ' hidden'}><p class="diagram-level-description">${escape(level.description)}</p><figure class="home-overview"><picture><source media="(max-width:760px)" srcset="/${level.file}-mobile.svg" width="360" height="${level.mobileHeight}"><img src="/${level.file}.svg" width="${level.width}" height="${level.height}" alt="${escape(level.alt)}" loading="lazy"></picture><figcaption><span>${escape(level.caption)}</span><a href="/${level.file}.svg">Open full size ↗</a></figcaption></figure><p class="diagram-takeaway">${escape(level.takeaway)}</p></section>`).join('')}
<section class="diagram-panel" id="diagram-panel-expert" role="tabpanel" aria-labelledby="diagram-tab-expert" tabindex="0" data-diagram-panel="expert" hidden><p class="diagram-level-description">The complexity is here on purpose: exact network paths, ports, provisioning, digests, trust boundaries and failure behavior, with links to the reviewed runtime source.</p><div class="expert-toolbar"><button type="button" data-expand-expert aria-expanded="false">Expand all details</button><button type="button" data-fit-map aria-pressed="false">Fit topology to screen</button><a href="/implementation.html">Open as a full guide ↗</a></div><div class="expert-content doc-content" data-expert-content>${intro}${expert}</div></section>
<noscript><p class="diagram-nojs">Other levels: <a href="/diagram-simple.svg">Just the idea</a> · <a href="/diagram-web.svg">Web basics</a> · <a href="/implementation.html">Expert implementation guide</a>. The TOAD overview above works without JavaScript.</p></noscript>
</div>`;
}
