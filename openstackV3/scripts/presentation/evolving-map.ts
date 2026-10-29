import { renderDetailBranches } from './diagram-depth.js';
import { renderComponentMap } from './component-map.js';

/** One persistent SVG scene. The client reveals layers without replacing nodes. */
export function renderEvolvingMap(): string {
  const text = (y: number, value: string, kind = 'map-title', x = 0) => `<text x="${x}" y="${y}" class="${kind}" text-anchor="middle">${value}</text>`;
  const icon = (name: string, size = 64) => `<use href="/teaching-icons.svg#${name}" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"/>`;
  const node = (name: string, content: string, reveal = '') => `<g data-map-node="${name}"${reveal ? ` data-reveal="${reveal}"` : ''}>${content}</g>`;
  const layer = (name: string, content: string, hide = false) => `<g data-${hide ? 'conceal' : 'reveal'}="${name}">${content}</g>`;
  const circle = (kind = 'visit', r = 46) => `<circle r="${r}" class="map-disc ${kind}"/>`;
  const path = (name: string, kind = 'visit', reveal = '') => `<path data-map-path="${name}" class="map-arrow ${kind}" marker-end="url(#evolving-${kind})"${reveal ? ` data-reveal="${reveal}"` : ''}/>`;
  return `<svg class="evolving-map" data-evolving-map viewBox="0 0 1120 800" width="1120" height="800" role="img" aria-labelledby="evolving-title evolving-desc" hidden>
<title id="evolving-title">One app, from your code to the TOAD implementation</title>
<desc id="evolving-desc">The same browser, Internet and app remain in view as details are revealed. This is a teaching model, not live infrastructure.</desc>
<defs>${[['visit', '#267b88'], ['ship', '#69873e'], ['lookup', '#7d8d89'], ['watch', '#827194']].map(([name, color]) => `<marker id="evolving-${name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="${color}"/></marker>`).join('')}</defs>
<g aria-hidden="true">
<g data-map-core>
<g data-reveal="cloud"><rect data-map-boundary rx="22" class="map-cloud-boundary"/>
${node('cloud-label', `${text(0, 'Your cloud account')}${text(24, 'Infomaniak · 3 rented servers', 'map-small')}${layer('network', text(45, 'Heat / Neutron · 10.0.0.0/24', 'map-technical'))}`)}</g>
${path('request')}${path('simple-route')}${path('return')}${path('simple-deploy', 'ship')}
${path('lookup-ask', 'lookup', 'dns')}${path('lookup-reply', 'lookup', 'dns')}
${path('public-route', 'visit', 'runtime')}${path('gateway-route', 'visit', 'runtime')}${path('app-route', 'visit', 'runtime')}
${path('ask-agent', 'ship')}${path('publish', 'ship', 'delivery')}${path('prepare', 'ship', 'delivery')}${path('deploy', 'ship', 'delivery')}${path('observe', 'watch', 'observe')}
${node('visitor', `${circle()}${icon('laptop')}${text(69, 'You open a link')}${layer('dns', text(95, 'my-app.platform.example.com', 'map-code'))}${layer('dns', text(95, 'On your phone or computer', 'map-small'), true)}`)}
${node('internet', `${circle('visit', 53)}${icon('cloud', 80)}${text(77, 'The Internet')}${text(102, 'Carries the request + reply', 'map-small')}`)}
${node('app', `${circle('ship')}${layer('runtime', icon('server'), true)}${layer('runtime', icon('app-window'))}${layer('runtime', `${text(69, 'The website computer')}${text(95, 'Sends the page back', 'map-small')}`, true)}${layer('runtime', `${text(69, 'Your running app')}${text(95, 'my-app', 'map-code')}`)}${layer('network', text(118, 'image@sha256:… · :3000', 'map-technical'))}`)}
${node('dns', `${circle('lookup', 30)}${icon('globe', 44)}${text(-48, 'DNS finds the address')}${text(53, 'Name → IP', 'map-small')}`, 'dns')}
${node('dns-detail', `${text(0, 'Designate · child zone + wildcard A', 'map-technical')}${text(21, '198.51.100.30 · record TTL 60 s', 'map-technical')}`, 'network')}
${node('lock', `${layer('runtime', circle())}${icon('lock-keyhole', 52)}${layer('runtime', text(61, 'HTTPS'), true)}${layer('runtime', `${text(69, 'HTTPS gateway')}${text(95, 'Traefik · one replica', 'map-small')}`)}${layer('network', text(118, 'TLS ends here · HTTP →', 'map-technical'))}`, 'https')}
${node('entry', `${circle()}${icon('globe', 56)}${text(69, 'Public entry')}${text(95, 'Load balancer', 'map-small')}${layer('network', text(118, 'Octavia · TCP 80 / 443', 'map-technical'))}`, 'runtime')}
${node('agent', `${circle('ship', 37)}${icon('laptop', 52)}${text(4, '&lt;/&gt;', 'map-laptop-code')}${layer('delivery', `<use href="/teaching-icons.svg#bot" x="19" y="10" width="31" height="31"/>${text(64, 'Your code + agent')}${text(88, 'Your app repository', 'map-small')}`)}${layer('delivery', `${text(64, 'My website')}${text(88, 'Code on my computer', 'map-small')}`, true)}`)}
${node('brief', `${layer('delivery', `<rect x="-108" y="-25" width="216" height="38" rx="9" class="map-brief-bubble"/>${text(0, 'Deploy my website', 'map-brief-text')}`, true)}`)}
${node('toad', `${circle('ship', 40)}<image href="/toad.svg" x="-33" y="-33" width="66" height="66"/>${text(64, 'TOAD')}${layer('delivery', text(88, 'Puts your website online', 'map-small'), true)}${layer('delivery', text(88, 'Your local CLI', 'map-small'))}${layer('network', text(110, 'Context · Heat · Ansible', 'map-technical'))}`)}
${node('package', `${circle('ship', 37)}${icon('package', 55)}${text(64, 'Your image registry')}${text(88, 'A service you choose', 'map-small')}${layer('network', text(110, 'Buildx push · Swarm pull · digest', 'map-technical'))}`, 'delivery')}
${node('managers', `${text(-45, 'Docker Swarm', 'map-small')}${[-106, 0, 106].map((x, index) => `<g transform="translate(${x} 0)"><rect x="-46" y="-28" width="92" height="100" rx="9" class="map-manager"/>${icon('server', 30)}${text(34, `manager-${index + 1}`, 'map-small')}${layer('network', text(56, `10.0.0.${20 + index}`, 'map-code'))}</g>`).join('')}${layer('network', text(96, 'Swarm quorum 2/3 · overlay 10.20.0.0/16', 'map-technical'))}`, 'cloud')}
${node('monitor', `${circle('watch', 30)}${icon('activity', 43)}${text(58, 'Your monitoring')}${text(83, 'Version · copies · HTTPS · freshness', 'map-small')}${layer('network', text(108, 'Prometheus :9090 · Grafana :3000 · mTLS', 'map-technical'))}`, 'observe')}
${node('other-paths', `${text(0, 'Other paths &amp; boundaries')}${text(27, 'SSH → 198.51.100.20 → manager-1', 'map-technical')}${text(49, 'Private: 22 / 2377 / 7946 / 4789', 'map-technical')}${text(71, 'Separate router for outbound traffic', 'map-technical')}${text(93, 'ACME + app data: node-local state', 'map-technical')}`, 'network')}
${node('return-label', text(0, 'The page comes back to your screen', 'map-small'))}
${node('route-label', text(0, 'Connect to the IP', 'map-small'), 'dns')}
${node('ingress-label', text(0, 'Swarm ingress · 80/443', 'map-technical'), 'network')}
${node('prepare-label', text(0, '1 · prepare your cloud', 'map-small ship'), 'delivery')}
${node('publish-label', text(0, '2 · publish', 'map-small ship'), 'delivery')}
${node('deploy-label', text(0, '3 · deploy', 'map-small ship'), 'delivery')}
</g>
<path data-map-spine class="map-unfold-path" data-reveal="network"/>
${renderComponentMap()}
${renderDetailBranches()}
</g></svg>`;
}
