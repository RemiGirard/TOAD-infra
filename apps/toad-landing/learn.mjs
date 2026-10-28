const map = document.querySelector('[data-learning-map]');
if (map) {
  const concepts = {
    domain: ['The name people type', 'Domain', 'A domain is a name you control, such as example.com. Your app can use an address below it, such as hello.platform.example.com. Buying a name does not buy a server.', 'People get a memorable app address. You choose the name and keep its registration active.'],
    dns: ['Find the right address', 'DNS', 'DNS is the lookup that turns your app’s name into its public network address. The browser gets the load balancer’s address, then connects to it. Website traffic does not travel through DNS.', 'Your app name points to the platform. The first setup includes a DNS delegation step that your agent can explain.'],
    cloud: ['Computers you rent', 'Cloud servers', 'The maintained TOAD platform rents three virtual computers in your Infomaniak project. Docker Swarm coordinates them. Your apps use their CPU, memory and storage.', 'You control the platform and pay the cloud bill. Three managers protect coordination; they do not duplicate every app or its data.'],
    entry: ['A front door for connections', 'Load balancer', 'Octavia is the public entry to the platform. It distributes incoming connections across the servers. Swarm forwards them to Traefik, the gateway that knows which app was requested.', 'Visitors use one public entry. The load balancer passes HTTPS through; it does not decrypt it here.'],
    https: ['An encrypted browser connection', 'HTTPS / TLS', 'Traefik presents a certificate for the app name and handles the encrypted connection. TLS is the current technology often called SSL. TOAD configures certificate automation once DNS access is ready.', 'Visitors can reach your app over HTTPS. Encryption does not add user accounts, fix insecure app code or make backend connections encrypted.'],
    container: ['Your app, running', 'Containers', 'An image packages your app and its runtime dependencies. A container is a running copy. TOAD builds and pins the image, then Swarm runs the declared copies, called replicas, on your servers.', 'A checked release of your own app. Your agent can prepare packaging; your source stays in its repository.'],
    data: ['Files that must survive', 'Persistent data', 'A database or uploaded files need a deliberate storage choice. TOAD’s local-volume profile keeps files on one chosen server. A volume survives container replacement; it is not a backup.', 'An explicit data and recovery plan. Databases, offsite backups and successful restore tests are not created just by shipping a web app.']
  };
  for (const button of map.querySelectorAll('[data-concept]')) {
    button.addEventListener('click', (event) => {
      const content = concepts[button.dataset.concept];
      if (!content) return;
      for (const candidate of map.querySelectorAll('[data-concept]')) candidate.setAttribute('aria-pressed', String(candidate === button));
      for (const [index, selector] of ['[data-concept-title]', '[data-concept-term]', '[data-concept-explanation]', '[data-concept-outcome]'].entries()) map.querySelector(selector).textContent = content[index];
      if (event.detail > 0 && matchMedia('(max-width:760px)').matches) map.querySelector('.map-explainer').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
}
