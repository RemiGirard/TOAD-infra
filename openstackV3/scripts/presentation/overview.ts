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

export function renderOverview(icons: Record<string, string>, mascot: string, license: string): {
  desktop: string; mobile: string; simpleDesktop: string; simpleMobile: string;
  webDesktop: string; webMobile: string; expert: string;
} {
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
  function wrap(width: number, height: number, body: string, mobile = false,
    description = 'You or your coding agent use TOAD to prepare a three-server cloud platform and publish a packaged app. Platform definitions stay in your repository and resources in your own provider project. A visitor looks up the app name in DNS, then connects to the public IP over HTTPS. Traefik handles encryption and routes to your running app. Read-only monitoring shows collected evidence. Data storage is optional and must be planned separately.',
    title = 'Your app: build it, publish it, visit it, understand it'): string {
    // Presentation attributes keep the standalone SVG usable under style-src 'self'.
    const sizes: Record<string, number> = { heading: 23, title: mobile ? 17 : 20, 'node-title': 18, body: mobile ? 14 : 16, small: mobile ? 13 : 16, tiny: mobile ? 11 : 14, code: mobile ? 12 : 14, label: mobile ? 11 : 12 };
    body = body.replace(/<text\b([^>]*?)class="([^"]+)"([^>]*)>/g, (_match, before: string, className: string, after: string) => {
      const classes = className.split(' ');
      const base = classes[0]!;
      const color = classes.includes('green') ? '#567530' : classes.includes('blue') ? '#246f7c' : classes.includes('purple') ? '#746181' : ['small', 'tiny'].includes(base) ? '#536951' : '#294332';
      return `<text${before}class="${className}"${after} font-family="${base === 'code' ? 'ui-monospace,monospace' : 'Arial,Helvetica,sans-serif'}" font-size="${sizes[base]}" font-weight="${['heading', 'title', 'node-title', 'label'].includes(base) ? 700 : 400}" fill="${color}"${base === 'label' ? ` letter-spacing="${mobile ? .6 : 1.2}"` : ''}>`;
    }).replaceAll('class="cloud"', 'class="cloud" fill="#edf3e3" stroke="#acbf98" stroke-width="1.5" stroke-dasharray="6 5"')
      .replaceAll('class="rule"', 'class="rule" stroke="#cbd7bf" stroke-width="1"');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escape(title)}</title>
<desc id="desc">${escape(description)}</desc>
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
  const simpleDescription = 'Your website starts as code on your computer. Deploying puts it on another computer that stays online. A browser can then request its pages across the Internet. The cloud drawing represents the Internet network, not the hosting computer.';
  const simpleDesktop = wrap(1120, 450, `
${text(30, 38, 'JUST THE IDEA · NO TECHNICAL WORDS', 'label', 'start')}
${dot(150, 170, '#e7efda', 61)}${icon('laptop', 106, 126, 88)}${text(150, 175, '</>', 'code')}
${text(150, 270, 'My website', 'title')}${text(150, 298, 'Code on my computer', 'small')}
${arrow('M225 170H475', 'ship')}${text(350, 150, 'Deploy my website', 'body green')}
${dot(560, 170, '#e0eef0', 67)}${icon('cloud', 508, 118, 104, '#267b88')}
${text(560, 270, 'The Internet', 'title')}${text(560, 298, 'Connects the two computers', 'small')}
${arrow('M642 170H895', 'ship')}
${dot(970, 170, '#e7efda', 61)}${icon('server', 926, 126, 88)}
${text(970, 270, 'The website computer', 'title')}${text(970, 298, 'Stays online to serve visitors', 'small')}
${arrow('M970 318V350H150V318', 'visit')}${text(560, 338, 'The page comes back to your screen', 'body blue')}
${frog(323, 381, 36)}${text(370, 407, 'TOAD helps you put your website on that other computer.', 'body', 'start')}
`, false, simpleDescription, 'From your code to an online website');
  const simpleMobile = wrap(360, 830, `
${text(20, 31, 'JUST THE IDEA', 'label', 'start')}
${dot(180, 115, '#e7efda', 48)}${icon('laptop', 144, 79, 72)}${text(180, 120, '</>', 'code')}
${text(180, 194, 'My website · my code', 'title')}
${arrow('M156 217V278', 'ship')}${arrow('M204 278V217', 'visit')}
${text(95, 251, 'deploy', 'small green')}${text(270, 251, 'page', 'small blue')}
${dot(180, 346, '#e0eef0', 52)}${icon('cloud', 138, 304, 84, '#267b88')}
${text(180, 430, 'The Internet connects them', 'title')}
${arrow('M156 453V510', 'ship')}${arrow('M204 510V453', 'visit')}
${text(95, 486, 'deploy', 'small green')}${text(270, 486, 'page', 'small blue')}
${dot(180, 577, '#e7efda', 48)}${icon('server', 144, 541, 72)}
${text(180, 659, 'The website computer', 'title')}${text(180, 685, 'Sends the page back to your screen', 'small')}
${frog(30, 727, 42)}${text(90, 746, 'TOAD helps you put', 'body', 'start')}${text(90, 770, 'your website on it.', 'body', 'start')}
${text(180, 808, 'The cloud drawing here means the Internet.', 'tiny')}
`, true, simpleDescription, 'How a website works: just the idea');

  const webDescription = 'A domain is the name in the link. DNS looks up its IP address. The browser then connects across the Internet over HTTPS to the website computer; DNS does not carry the page. HTTPS protects the browser connection and uses a certificate for the domain. The computer runs your application and returns a page or API response. Addresses are reserved examples.';
  const webDesktop = wrap(1120, 580, `
${text(30, 38, 'WEB BASICS · NAMES, ADDRESSES AND A SECURE CONNECTION', 'label', 'start')}
${dot(130, 110, '#e9f0ee', 34)}${icon('globe', 105, 85, 50, '#47747b')}
${text(190, 104, 'DNS finds the address', 'title', 'start')}${text(190, 132, 'Name → 198.51.100.30', 'code', 'start')}
${arrow('M104 254V164', 'lookup')}${arrow('M156 164V254', 'lookup')}
${text(76, 218, 'ask', 'tiny', 'end')}${text(179, 218, 'IP address', 'tiny', 'start')}
${dot(130, 320, '#e0eef0', 51)}${icon('app-window', 92, 282, 76, '#267b88')}
${text(130, 411, 'The browser', 'title')}${text(130, 440, 'my-app.platform.example.com', 'code')}
${arrow('M196 320H487', 'visit')}${text(350, 300, 'Connect to the IP', 'body blue')}
${dot(560, 320, '#e0eef0', 54)}${icon('cloud', 516, 276, 88, '#267b88')}
${text(560, 411, 'The Internet', 'title')}${text(560, 440, 'Carries the request and the reply', 'small')}
${arrow('M628 320H906', 'visit')}${icon('lock-keyhole', 747, 252, 44, '#267b88')}
${text(770, 237, 'HTTPS', 'title blue')}${text(770, 356, 'Encrypted connection', 'small blue')}
${dot(980, 320, '#e7efda', 53)}${icon('server', 942, 282, 76)}
${text(980, 411, 'The website computer', 'title')}${text(980, 440, 'Runs your app and sends the page', 'small')}
<path d="M30 487H1090" class="rule"/>
${text(30, 519, 'Domain = the name · IP = the address · DNS = the lookup', 'body', 'start')}
${text(30, 548, 'HTTPS protects the browser connection. The lock is protection, not another computer.', 'body', 'start')}
`, false, webDescription, 'Web basics: domain, DNS, IP address and HTTPS');
  const webMobile = wrap(360, 1110, `
${text(20, 31, 'WEB BASICS', 'label', 'start')}
${icon('globe', 38, 73, 46, '#47747b')}${text(103, 93, 'DNS finds the address', 'title', 'start')}
${text(103, 119, 'Name → IP address', 'small', 'start')}
${arrow('M151 211V148', 'lookup')}${arrow('M206 148V211', 'lookup')}
${text(111, 185, 'ask', 'tiny', 'end')}${text(226, 185, 'IP', 'tiny', 'start')}
${dot(180, 267, '#e0eef0', 42)}${icon('app-window', 148, 235, 64, '#267b88')}
${text(180, 340, 'The browser opens a name', 'title')}${text(180, 367, 'my-app.platform.example.com', 'code')}
${arrow('M180 389V454', 'visit')}${text(200, 426, 'connect to the IP', 'small blue', 'start')}
${dot(180, 510, '#e0eef0', 43)}${icon('cloud', 144, 474, 72, '#267b88')}
${text(180, 585, 'The Internet carries it', 'title')}
${arrow('M180 607V752', 'visit')}${icon('lock-keyhole', 210, 642, 38, '#267b88')}
${text(266, 704, 'HTTPS', 'title blue')}
${dot(180, 810, '#e7efda', 42)}${icon('server', 148, 778, 64)}
${text(180, 884, 'Your app runs on this computer', 'title')}${text(180, 911, 'The page returns over the connection', 'small')}
<path d="M22 947H338" class="rule"/>
${text(180, 978, 'DNS only looks up the address.', 'body')}${text(180, 1003, 'The website does not pass through DNS.', 'small')}
${text(180, 1045, 'HTTPS protects the browser connection.', 'body')}${text(180, 1071, 'The lock is not a separate computer.', 'small')}
`, true, webDescription, 'Web basics, from a name to the running app');

  function card(x: number, y: number, width: number, height: number, title: string, lines: string[], pictogram: string): string {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="9" fill="#fafbf5" stroke="#b5c5a5"/>${icon(pictogram, x + width - 43, y + 13, 27)}${text(x + 15, y + 32, title, 'node-title', 'start')}${lines.map((line, index) => text(x + 15, y + 62 + index * 22, line, 'tiny', 'start')).join('')}`;
  }
  const expert = wrap(1280, 1240, `
${text(24, 31, 'IMPLEMENTATION · MAINTAINED THREE-MANAGER PROFILE', 'label', 'start')}
${card(20, 60, 280, 190, 'Operator / agent', ['Local context + TypeScript CLI', 'Heat / Ansible / app manifests', 'SSH key, CA key and age identity', 'remain in the operator environment'], 'laptop')}
${card(390, 60, 350, 190, 'DNS lookup', ['Parent NS delegates the child zone', 'Designate: child apex + wildcard A', 'Record TTL 60 s; zone TTL 300 s', 'Answers the load-balancer IPv4'], 'globe')}
${card(840, 60, 400, 190, 'Browser / admin client', ['my-app.platform.example.com', 'App HTTPS uses the public entry', 'Admin hosts additionally require mTLS', 'Public apps need their own auth policy'], 'app-window')}
${arrow('M755 129H824', 'lookup')}${arrow('M824 164H755', 'lookup')}
${arrow('M305 150H345V277H590V294')}${text(366, 267, 'OpenStack APIs / Heat', 'tiny', 'start')}
<rect x="20" y="300" width="1240" height="840" rx="18" fill="#edf3e3" stroke="#a7bc90" stroke-dasharray="7 5"/>
${text(40, 330, 'YOUR CLOUD PROJECT · HEAT STACK my-cloud', 'label', 'start')}
<rect x="340" y="350" width="890" height="755" rx="13" fill="#f4f7ed" stroke="#b6c6a5"/>
${text(360, 380, 'NEUTRON TENANT 10.0.0.0/24 · gateway 10.0.0.1', 'label', 'start')}
${card(40, 400, 260, 170, 'SSH entry', ['Floating IPv4: 198.51.100.20', 'TCP 22 from configured CIDR', '/32 in the worked example', 'ubuntu; manager 1 is the jump'], 'laptop')}
${arrow('M15 200H8V485H34')}
${arrow('M305 525H331V665H369')}
${card(40, 630, 260, 170, 'Outbound router', ['Provider-assigned gateway IP', '198.51.100.40 here is an example', 'Private VMs use it for egress', 'Separate from the app / SSH IP'], 'cloud')}
${arrow('M370 742H320V715H305', 'lookup')}
${card(40, 860, 260, 230, 'Declared resources', ['3 Nova servers; configured AZs', 'Soft anti-affinity server group', 'Private net, subnet and router', 'Two floating IP resources', 'Octavia LB, pools and members', 'Designate child DNS zone', 'Not a live resource inventory'], 'server')}
${card(750, 410, 450, 145, 'Octavia public entrance', ['Floating IPv4: 198.51.100.30 → private VIP', 'TCP 80 + 443; ROUND_ROBIN pools', 'TCP checks: delay 10 s / timeout 5 s / retries 3', 'TCP passthrough: no TLS termination here'], 'cloud')}
${arrow('M1040 254V403', 'visit')}${text(1060, 282, 'TCP 80 / 443', 'tiny blue', 'start')}
${arrow('M975 560V582H495V610', 'visit')}${arrow('M975 582H775V610', 'visit')}${arrow('M975 582H1055V610', 'visit')}
${card(370, 615, 250, 114, 'manager-1', ['10.0.0.20 · bootstrap / SSH', 'Traefik + monitoring labels'], 'server')}
${card(650, 615, 250, 114, 'manager-2', ['10.0.0.21 · Swarm manager', 'Private SSH via manager 1'], 'server')}
${card(930, 615, 270, 114, 'manager-3', ['10.0.0.22 · Swarm manager', 'Private SSH via manager 1'], 'server')}
${text(370, 760, 'Swarm: quorum 2/3 · ingress 80/443 · overlay pool 10.20.0.0/16 (/24 allocations)', 'tiny', 'start')}
${arrow('M775 775V789H520V809', 'visit')}
${card(370, 815, 300, 147, 'Traefik · one replica', ['traefik-public overlay', 'TLS terminates here; host/path routes', 'Pinned local ACME certificate store', 'Infomaniak DNS token: Swarm secret'], 'lock-keyhole')}
${arrow('M676 887H773', 'visit')}${text(724, 870, 'HTTP', 'tiny blue')}
${card(780, 815, 420, 147, 'Application service', ['Pinned image digest; manifest-defined replicas', 'Example Node app: internal TCP 3000', 'No direct published application ports', 'Stateless copies or explicit pinned local volume'], 'app-window')}
${arrow('M520 968V980H790V988', 'watch')}${text(870, 984, 'Admin routes add client-certificate verification', 'tiny', 'start')}
${card(370, 995, 830, 93, 'Monitoring services', ['Prometheus :9090 · Grafana :3000 · Alertmanager :9093 · Loki :3100', 'Global Alloy / node-exporter / cAdvisor; blackbox HTTPS checks; local state volumes'], 'activity')}
${text(24, 1176, 'Public IPs are reserved documentation examples. Private IPs and ports are declared profile defaults.', 'body', 'start')}
${text(24, 1206, 'Topology is an implementation model, not live health or task placement. Detailed sources, trust and failure behavior follow below.', 'tiny', 'start')}
`, false, 'Declared TOAD network and runtime implementation. The operator uses OpenStack and SSH. DNS resolves the app name to the load-balancer floating IPv4. Octavia forwards TCP 80 and 443 to the three private Swarm managers. The routing mesh reaches one pinned Traefik replica, which terminates TLS and routes to the app. SSH, outbound routing, monitoring and mTLS administration are distinct paths. Public IPs are reserved examples; this is not a live health or placement map.', 'TOAD expert network and runtime topology');
  return { desktop, mobile, simpleDesktop, simpleMobile, webDesktop, webMobile, expert };
}
