// Teaching only: reserved examples, no requests to infrastructure.
const visitSteps = [
  { parts: ['browser'], title: 'Start with a name people can remember.', description: 'You control example.com. The name my-app.platform.example.com identifies this app; it is not another server.' },
  { parts: ['browser', 'dns'], title: 'DNS answers: “Use this public IP address.”', description: 'The A record resolves the name to 198.51.100.30, the load balancer’s public IPv4. DNS has finished its job; it does not carry the page.' },
  { parts: ['entry', 'https'], title: 'HTTPS encrypts the browser connection.', description: 'A certificate lets the browser verify your domain. Octavia forwards the encrypted connection on port 443 through Swarm to Traefik. Traefik presents the certificate and decrypts the connection; this is TLS, often called SSL.' },
  { parts: ['https', 'app'], title: 'The hostname chooses your app.', description: 'Traefik forwards to my-app on its internal port 3000. A container is a running copy of the packaged app. You do not expose port 3000 to visitors.' },
  { parts: ['browser', 'app'], title: 'The browser receives the page or API response.', description: 'The response returns over the connection. Publishing another app reuses the platform and entrance; its own hostname chooses its service.' },
];
for (const root of document.querySelectorAll('[data-visit]')) {
  const buttons = [...root.querySelectorAll('[data-visit-step]')];
  const play = root.querySelector('[data-visit-play]');
  let step = 0;
  let timer;
  function stop() {
    clearTimeout(timer);
    timer = undefined;
    play.textContent = 'Follow a visit';
  }
  function select(index) {
    step = index;
    const state = visitSteps[index];
    for (const button of buttons) button.setAttribute('aria-pressed', String(Number(button.dataset.visitStep) === index));
    for (const part of root.querySelectorAll('[data-visit-part]')) part.dataset.current = String(state.parts.includes(part.dataset.visitPart));
    root.querySelector('[data-visit-title]').textContent = state.title;
    root.querySelector('[data-visit-description]').textContent = state.description;
  }
  function advance() {
    if (step === visitSteps.length - 1) { stop(); return; }
    select(step + 1);
    timer = setTimeout(advance, 4200);
  }
  for (const button of buttons) button.addEventListener('click', () => { stop(); select(Number(button.dataset.visitStep)); });
  play.addEventListener('click', () => {
    if (timer !== undefined) { stop(); return; }
    select(0);
    play.textContent = 'Pause';
    timer = setTimeout(advance, 4200);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  root.querySelector('[data-visit-controls]').hidden = false;
  select(0);
}
