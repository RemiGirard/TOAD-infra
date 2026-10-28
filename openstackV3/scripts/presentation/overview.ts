/** Public teaching illustration: reviewed icon sources, no infrastructure data. */
export const overviewIcons = ['laptop', 'bot', 'package', 'cloud', 'server', 'globe', 'lock-keyhole', 'app-window', 'activity', 'database'] as const;
export const teachingIconNames = [...overviewIcons, 'user-round', 'folder'] as const;

function svgContents(svg: string): string {
  const body = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1];
  if (!body || /<(?:script|foreignObject|image|use)\b|\bon\w+=|(?:href|url\()/i.test(body)) throw new Error('Review overview icon source.');
  return body.trim();
}

export function renderTeachingSprite(icons: Record<string, string>, license: string): string {
  const notice = license.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg"><metadata>${notice}</metadata><defs>${teachingIconNames.map(name => `<symbol id="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${svgContents(icons[name]!)}</symbol>`).join('')}</defs></svg>\n`;
}

export function renderOverview(icons: Record<string, string>, mascot: string, license: string): { desktop: string; mobile: string } {
  const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const symbols = overviewIcons.map((name) => `<symbol id="${name}" viewBox="0 0 24 24">${svgContents(icons[name]!)}</symbol>`).join('\n') + `<symbol id="toad" viewBox="0 0 64 64">${svgContents(mascot)}</symbol>`;
  function icon(name: string, x: number, y: number, size = 64, color = '#355440'): string {
    return `<use href="#${name}" x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const frog = (x: number, y: number, size = 76) => `<use href="#toad" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
  function text(x: number, y: number, value: string, className = 'body', anchor = 'middle'): string {
    return `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">${escape(value)}</text>`;
  }
  const arrow = (path: string, kind: 'ship' | 'visit' | 'lookup' | 'watch' = 'ship') => {
    const color = { ship: '#69873e', visit: '#267b88', lookup: '#7d8d89', watch: '#827194' }[kind];
    const dash = kind === 'lookup' ? ' stroke-dasharray="4 5"' : kind === 'watch' ? ' stroke-dasharray="7 5"' : '';
    return `<path d="${path}" class="arrow ${kind}" fill="none" stroke="${color}" stroke-width="${kind === 'lookup' ? 1.8 : kind === 'watch' ? 2 : 2.4}" stroke-linecap="round" stroke-linejoin="round"${dash} marker-end="url(#${kind})"/>`;
  };
  const dot = (x: number, y: number, fill = '#e7efda', radius = 46) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;
  function wrap(width: number, height: number, body: string, mobile = false): string {
    // Presentation attributes keep the standalone SVG usable under style-src 'self'.
    const sizes: Record<string, number> = { heading: 23, title: mobile ? 17 : 20, body: mobile ? 14 : 16, small: mobile ? 13 : 16, tiny: mobile ? 11 : 14, code: mobile ? 12 : 14, label: mobile ? 11 : 12 };
    body = body.replace(/<text\b([^>]*?)class="([^"]+)"([^>]*)>/g, (_match, before: string, className: string, after: string) => {
      const classes = className.split(' ');
      const base = classes[0]!;
      const color = classes.includes('green') ? '#567530' : classes.includes('blue') ? '#246f7c' : classes.includes('purple') ? '#746181' : ['small', 'tiny'].includes(base) ? '#536951' : '#294332';
      return `<text${before}class="${className}"${after} font-family="${base === 'code' ? 'ui-monospace,monospace' : 'Arial,Helvetica,sans-serif'}" font-size="${sizes[base]}" font-weight="${['heading', 'title', 'label'].includes(base) ? 700 : 400}" fill="${color}"${base === 'label' ? ` letter-spacing="${mobile ? .6 : 1.2}"` : ''}>`;
    }).replaceAll('class="cloud"', 'class="cloud" fill="#edf3e3" stroke="#acbf98" stroke-width="1.5" stroke-dasharray="6 5"')
      .replaceAll('class="rule"', 'class="rule" stroke="#cbd7bf" stroke-width="1"');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">Your app: build it, publish it, visit it, understand it</title>
<desc id="desc">You or your coding agent use TOAD to prepare a three-server cloud platform and publish a packaged app. Platform definitions stay in your repository and resources in your own provider project. A visitor looks up the app name in DNS, then connects to the public IP over HTTPS. Traefik handles encryption and routes to your running app. Read-only monitoring shows collected evidence. Data storage is optional and must be planned separately.</desc>
<metadata>TOAD illustration: MIT, Remi Girard. Icon source: https://github.com/lucide-icons/lucide/tree/be09619c1c1124ad09c19fc3e87ee3b939409bbd\n${escape(license)}</metadata>
<defs>${symbols}
${[['ship', '#69873e'], ['visit', '#267b88'], ['lookup', '#7d8d89'], ['watch', '#827194']].map(([id, color]) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="${color}"/></marker>`).join('')}
</defs>
<rect width="${width}" height="${height}" rx="14" fill="#f8faf2"/>
${body}
</svg>\n`;
  }

  const desktop = wrap(1120, 860, `
${text(30, 38, 'ONE APP. THE WHOLE PICTURE.', 'label', 'start')}
${text(30, 75, 'You ship it', 'title green', 'start')}
${text(1090, 38, 'Current three-server TOAD platform · teaching example', 'tiny', 'end')}
${dot(130, 156)}${icon('laptop', 88, 119, 84)}${dot(199, 182, '#e8eee2', 28)}${icon('bot', 178, 161, 42)}
${text(145, 235, 'Your code + your agent', 'title')}${text(145, 259, 'Your app stays in your repository', 'small')}
${arrow('M244 156H342')}${text(294, 139, 'ask / type', 'small green')}
${dot(400, 156, '#dceabf', 50)}${frog(361, 115, 78)}
${text(400, 235, 'TOAD', 'title')}${text(400, 259, 'Your local CLI', 'small')}
${arrow('M458 156H622')}${text(540, 138, '2 · publish', 'body green')}${text(540, 183, 'build & upload', 'tiny')}
${dot(680, 156)}${icon('package', 647, 123, 66)}
${text(680, 235, 'Your app, packaged', 'title')}${text(680, 259, 'Registry you choose', 'small')}
${arrow('M400 278V326')}${text(418, 305, '1 · prepare your cloud', 'body green', 'start')}
<rect x="340" y="334" width="750" height="395" rx="24" class="cloud"/>
${arrow('M738 156H974Q1004 156 1004 186V486')}${text(986, 276, '3 · deploy', 'body green', 'end')}
${icon('cloud', 365, 353, 42)}${text(420, 376, 'Your cloud account', 'heading', 'start')}${text(420, 399, 'Infomaniak Public Cloud · OpenStack underneath', 'small', 'start')}
${text(30, 318, 'People visit it', 'title blue', 'start')}
${dot(120, 376, '#e9f0ee', 33)}${icon('globe', 96, 352, 48, '#47747b')}
${text(173, 367, 'DNS', 'title', 'start')}${text(173, 390, 'Name → IP', 'small', 'start')}
${arrow('M90 493V426', 'lookup')}${arrow('M148 426V493', 'lookup')}
${text(64, 465, 'ask', 'tiny', 'end')}${text(167, 465, 'address', 'tiny', 'start')}
${dot(120, 540, '#e0eef0')}${icon('app-window', 84, 504, 72, '#267b88')}
${text(120, 609, 'A visitor opens your link', 'body')}${text(120, 634, 'my-app.platform.example.com', 'code')}
${arrow('M174 540H418', 'visit')}${text(288, 521, 'connect to that IP', 'small blue')}
${dot(470, 540, '#e0eef0', 44)}${icon('cloud', 438, 508, 64, '#267b88')}
${text(470, 609, 'Public IP', 'title')}${text(470, 633, 'Your internet entrance', 'small')}
${arrow('M522 540H647', 'visit')}${text(586, 521, 'HTTPS', 'small blue')}
${dot(700, 540, '#e0eef0', 44)}${icon('lock-keyhole', 670, 510, 60, '#267b88')}
${text(700, 609, 'HTTPS gateway', 'title')}${text(700, 633, 'Traefik decrypts & routes', 'small')}
${arrow('M752 540H925', 'visit')}${text(838, 521, 'app request', 'small blue')}
${dot(980, 540, '#dceabf', 46)}${icon('app-window', 947, 507, 66)}
${text(980, 609, 'Your running app', 'title')}${text(980, 633, 'my-app', 'code')}
<path d="M374 662H1057" class="rule"/>
${icon('server', 409, 680, 30)}${icon('server', 449, 680, 30)}${icon('server', 489, 680, 30)}
${text(542, 701, 'Three servers run this platform · app placement is simplified', 'small', 'start')}
${text(140, 704, 'DNS finds the address.', 'small')}${text(140, 725, 'The page does not pass through DNS.', 'tiny')}
${arrow('M707 732V766H467V780', 'watch')}
${dot(468, 811, '#eee9f2', 31)}${icon('activity', 445, 788, 46, '#827194')}
${text(515, 802, 'Your monitoring, for you and your agent', 'title', 'start')}${text(515, 827, 'Read-only evidence: version, app copies, HTTPS, freshness', 'small', 'start')}
${icon('database', 76, 781, 34)}${text(121, 797, 'Data is optional.', 'small', 'start')}${text(121, 819, 'Plan storage + backups.', 'tiny', 'start')}
`);

  const mobile = wrap(360, 1570, `
${text(22, 31, 'ONE APP. THE WHOLE PICTURE.', 'label', 'start')}
${text(22, 60, 'You ship it', 'title green', 'start')}
${dot(84, 122, '#e7efda', 37)}${icon('laptop', 54, 92, 60)}${dot(125, 149, '#e8eee2', 21)}${icon('bot', 109, 133, 32)}
${text(87, 196, 'Your code + agent', 'body')}
${arrow('M151 122H216')}${text(183, 103, 'ask / type', 'tiny green')}
${dot(265, 122, '#dceabf', 41)}${frog(233, 87, 64)}${text(265, 196, 'TOAD · your CLI', 'title')}
${arrow('M249 212V230H83V266')}${text(100, 251, '2 · publish image', 'small green', 'start')}
${arrow('M278 212V266')}${text(335, 247, '1 · setup', 'tiny green', 'end')}
${dot(83, 306, '#e7efda', 35)}${icon('package', 56, 279, 54)}${text(83, 364, 'App package', 'body')}${text(83, 386, 'Registry you choose', 'tiny')}
${dot(265, 306, '#e7efda', 35)}${icon('cloud', 239, 280, 52)}${text(265, 364, 'Your cloud', 'body')}${text(265, 386, '3 rented servers', 'tiny')}
${arrow('M83 398V429H144V453')}${arrow('M265 398V429H218V453')}
${text(180, 432, '3 · deploy', 'tiny green')}
${dot(180, 482, '#dceabf', 30)}${icon('app-window', 157, 459, 46)}${text(180, 536, 'my-app is running in your cloud', 'body')}
<path d="M22 565H338" class="rule"/>
${text(22, 597, 'People visit it', 'title blue', 'start')}
${dot(83, 659, '#e0eef0', 33)}${icon('app-window', 58, 634, 50, '#267b88')}${text(83, 716, 'A visitor', 'body')}
${dot(268, 659, '#e9f0ee', 33)}${icon('globe', 243, 634, 50, '#47747b')}${text(268, 716, 'DNS · name → IP', 'body')}
${arrow('M128 643H222', 'lookup')}${arrow('M222 675H128', 'lookup')}${text(176, 629, 'look up the name', 'tiny')}
${text(180, 750, 'my-app.platform.example.com', 'code')}
<rect x="22" y="803" width="316" height="562" rx="20" class="cloud"/>
${arrow('M83 763V781H180V851', 'visit')}
${text(39, 833, 'SAME CLOUD', 'label', 'start')}${text(39, 854, 'Infomaniak', 'tiny', 'start')}
${dot(180, 893, '#e0eef0', 35)}${icon('cloud', 153, 866, 54, '#267b88')}${text(180, 951, 'Public IP · internet entrance', 'title')}
${arrow('M180 970V1015', 'visit')}${text(197, 994, 'HTTPS', 'small blue', 'start')}
${dot(180, 1052, '#e0eef0', 33)}${icon('lock-keyhole', 155, 1027, 50, '#267b88')}${text(180, 1106, 'HTTPS gateway', 'title')}${text(180, 1128, 'Traefik decrypts & routes', 'small')}
${arrow('M180 1143V1179', 'visit')}${text(197, 1168, 'app request', 'tiny blue', 'start')}
${dot(180, 1218, '#dceabf', 34)}${icon('app-window', 155, 1193, 50)}${text(180, 1274, 'Your running app · my-app', 'title')}
${icon('server', 95, 1303, 24)}${icon('server', 126, 1303, 24)}${icon('server', 157, 1303, 24)}${text(197, 1320, '3 servers', 'small', 'start')}
${text(180, 1347, 'Placement is simplified', 'tiny')}
${arrow('M180 1369V1406', 'watch')}
${dot(180, 1437, '#eee9f2', 27)}${icon('activity', 160, 1417, 40, '#827194')}
${text(180, 1490, 'Your monitoring, for you and your agent', 'body')}${text(180, 1512, 'Versions · copies · HTTPS · freshness', 'tiny')}
${text(180, 1545, 'Data? Plan storage + backups separately.', 'tiny')}
`, true);
  return { desktop, mobile };
}
