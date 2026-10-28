const map = document.querySelector('[data-learning-map]');
if (map) {
  let model = 'ipv6';
  const concepts = {
    domain: ['The name people type', 'Domain', 'A domain is a name you control, such as example.com. Your app can use an address below it, such as hello.platform.example.com. Buying a name does not buy a server.', 'People get a memorable app address. You choose the name and keep its registration active.'],
    dns: ['Find the right address', 'DNS', 'DNS is the lookup that turns your app’s name into its public network address. The browser gets the load balancer’s address, then connects to it. Website traffic does not travel through DNS.', 'Your app name points to the platform. The first setup includes a DNS delegation step that your agent can explain.'],
    cloud: ['Computers you rent', 'Cloud servers', 'The maintained TOAD platform rents three virtual computers in your Infomaniak project. Docker Swarm coordinates them. Your apps use their CPU, memory and storage.', 'You control the platform and pay the cloud bill. Three managers protect coordination; they do not duplicate every app or its data.'],
    entry: ['A front door for connections', 'Load balancer', 'Octavia is the public entry to the platform. It distributes incoming connections across the servers. Swarm forwards them to Traefik, the gateway that knows which app was requested.', 'Visitors use one public entry. The load balancer passes HTTPS through; it does not decrypt it here.'],
    https: ['An encrypted browser connection', 'HTTPS / TLS', 'Traefik presents a certificate for the app name and handles the encrypted connection. TLS is the current technology often called SSL. TOAD configures certificate automation once DNS access is ready.', 'Visitors can reach your app over HTTPS. Encryption does not add user accounts, fix insecure app code or make backend connections encrypted.'],
    container: ['Your app, running', 'Containers', 'An image packages your app and its runtime dependencies. A container is a running copy. TOAD builds and pins the image, then Swarm runs the declared copies, called replicas, on your servers.', 'A checked release of your own app. Your agent can prepare packaging; your source stays in its repository.'],
    data: ['Files that must survive', 'Persistent data', 'A database or uploaded files need a deliberate storage choice. TOAD’s local-volume profile keeps files on one chosen server. A volume survives container replacement; it is not a backup.', 'An explicit data and recovery plan. Databases, offsite backups and successful restore tests are not created just by shipping a web app.']
  };
  const ipv6Concepts = {
    dns: ['A name becomes a network address', 'DNS / AAAA', 'DNS looks up hello.platform.example.com and returns an IPv6 address, shown here as the reserved example 2001:db8::20. An AAAA record maps a name to IPv6; an A record does the same for IPv4. Web requests then connect to that address.', 'A stable name for the app. The proposed IPv6 starter needs AAAA automation; current TOAD automation manages A records.'],
    cloud: ['One computer you rent', 'Minimum design', 'A small virtual machine can run an app directly. Infomaniak offers ext-v6only1 with free public IPv6, so this design needs no paid IPv4, load balancer or customer router.', 'A low-cost provider architecture. TOAD’s one-node IPv6 app profile and lightweight monitoring still need implementation and runtime validation.'],
    entry: ['Connect straight to the server', 'Public IPv6', 'An IPv6 address identifies the server on the internet. Its firewall permits the app’s HTTPS connection and restricted operator access. Direct IPv6 avoids the load balancer, but IPv4-only visitors need an additional dual-stack edge or IPv4.', 'Fewer paid components and one failure point. The operator, visitors, image registry and app dependencies need working connectivity.'],
    https: ['An encrypted browser connection', 'HTTPS / TLS', 'The proposed gateway presents a certificate for the app name and routes to the container. TLS is the current technology often called SSL. IPv6 DNS, certificate issuance, container ingress and outbound connectivity must be tested together.', 'The intended result is an HTTPS app URL. This teaching design is not yet a verified TOAD deployment recipe.']
  };
  function explain(button) {
      const content = model === 'ipv6' && ipv6Concepts[button.dataset.concept] ? ipv6Concepts[button.dataset.concept] : concepts[button.dataset.concept];
      if (!content) return;
      for (const candidate of map.querySelectorAll('[data-concept]')) candidate.setAttribute('aria-pressed', String(candidate === button));
      for (const [index, selector] of ['[data-concept-title]', '[data-concept-term]', '[data-concept-explanation]', '[data-concept-outcome]'].entries()) map.querySelector(selector).textContent = content[index];
  }
  for (const button of map.querySelectorAll('[data-concept]')) {
    button.addEventListener('click', (event) => {
      explain(button);
      if (event.detail > 0 && matchMedia('(max-width:760px)').matches) map.querySelector('.map-explainer').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  for (const button of document.querySelectorAll('[data-map-model]')) button.addEventListener('click', () => {
    model = button.dataset.mapModel;
    for (const candidate of document.querySelectorAll('[data-map-model]')) candidate.setAttribute('aria-pressed', String(candidate === button));
    const ipv6 = model === 'ipv6';
    const fields = {
      '[data-map-status]': ipv6 ? 'Minimum design · TOAD profile pending' : 'Current TOAD profile · teaching example',
      '[data-cloud-title]': ipv6 ? 'Your cloud · 1 rented server' : 'Your cloud · 3 rented servers',
      '[data-map-address]': ipv6 ? '2001:db8::20' : '198.51.100.30',
      '[data-map-record]': ipv6 ? 'AAAA record · name → IPv6 address' : 'A record · name → load-balancer IPv4',
      '[data-entry-title]': ipv6 ? 'Direct public IPv6' : 'Public load balancer',
      '[data-entry-description]': ipv6 ? 'No load balancer and no paid IPv4' : 'Octavia passes connections through the servers',
      '[data-map-note]': ipv6 ? 'One server, one failure point. This is the low-cost design to implement and validate; current TOAD’s complete deployment uses the other profile.' : 'Three managers coordinate the platform. One Traefik replica. App copies and storage depend on your manifest; data is not automatically replicated.'
    };
    for (const [selector, text] of Object.entries(fields)) map.querySelector(selector).textContent = text;
    for (const server of map.querySelectorAll('[data-extra-server]')) server.hidden = ipv6;
    explain(map.querySelector('[data-concept][aria-pressed="true"]'));
  });
}

const builder = document.querySelector('[data-setup-builder]');
if (builder) {
  const results = ['A project you own and access stored locally. Next, review costs and the exact target.', 'Three rented servers and a public entry IP. You can inspect what exists before putting an app on it.', 'The name resolves to the public IP. HTTPS reaches the hello container; the app now has a URL people can use.', 'Compare requested and running versions, app copies and endpoint checks. Keep missing or stale evidence visible.'];
  const statuses = ['Account access ready', 'Platform created and verified', 'App released and diagnosed', 'Observation collected'];
  for (const button of builder.querySelectorAll('[data-setup-step]')) button.addEventListener('click', () => {
    const step = Number(button.dataset.setupStep);
    for (const candidate of builder.querySelectorAll('[data-setup-step]')) candidate.setAttribute('aria-pressed', String(candidate === button));
    builder.querySelector('[data-setup-empty]').hidden = step > 0;
    builder.querySelector('[data-setup-infra]').hidden = step < 1;
    builder.querySelector('[data-setup-app]').hidden = step < 2;
    builder.querySelector('[data-setup-checks]').hidden = step < 3;
    builder.querySelector('[data-setup-status]').textContent = statuses[step];
    builder.querySelector('[data-setup-result]').textContent = results[step];
  });
}
