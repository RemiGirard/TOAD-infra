/** A local, illustrative story. No operator commands or private data are used. */
const observe = './toad observe --app my-app --context my-cloud --json';
const deploy = './toad app deploy my-app --context my-cloud';
const diagnose = './toad app diagnose my-app --context my-cloud --json';
const baseline = {
  flow: 'inspect', quorum: '3/3 managers', observation: 'Fresh observation',
  route: ['healthy', 'HTTPS → v1'], current: ['healthy', '2 ready · serving traffic'],
  candidate: ['waiting', 'Not deployed yet'],
  image: ['waiting', 'v2 pending'], replicas: ['healthy', '2/2 · v1'], https: ['healthy', '200 · v1'],
  note: 'One existing platform. A new app release.',
};
const rolling = { ...baseline, flow: 'deploy', candidate: ['working', 'Starting · not ready'],
  note: 'With start-first updates, v1 serves while a v2 task starts.' };
const delivered = { ...baseline, flow: 'verified', route: ['healthy', 'HTTPS → v2'],
  current: ['retired', 'Drained after replacement'], candidate: ['healthy', '2 ready · serving traffic'],
  image: ['healthy', 'v2 matched'], replicas: ['healthy', '2/2 · v2'], https: ['healthy', '200 · v2'],
  note: 'Requested image = service image = running task images.' };
const recovered = { ...baseline, flow: 'rollback', candidate: ['failed', 'Unhealthy · rolled back'],
  image: ['failed', 'v2 not running'], note: 'v1 is available again. The requested v2 release failed.' };
const missing = { ...baseline, flow: 'unknown', quorum: 'Quorum unknown', observation: 'Observation expired',
  route: ['unknown', 'Route unconfirmed'], current: ['unknown', 'Last seen: v1 · 2 ready'],
  candidate: ['unknown', 'Running image unknown'], image: ['unknown', 'Unconfirmed'],
  replicas: ['unknown', 'Last seen 2/2'], https: ['healthy', '200 · version ?'],
  note: 'A passing endpoint alone cannot prove which image is running.' };
const opening = [
  { speaker: 'READING THE ROOM', message: 'I’ll check my-cloud before changing my-app. Version one is serving; version two still needs a plan.',
    command: observe, lines: ['Context: my-cloud · app: my-app', 'Current release: v1 · ready replicas: 2/2', 'Requested release: v2 · not deployed'], view: baseline,
    status: 'Inspecting', report: 'First, establish what is running. A healthy v1 does not prove v2 shipped.' },
  { speaker: 'CHECKING THE GUARDRAILS', message: 'The v2 image is pinned. I’m checking the manifest, resource limits, health checks, and rollback policy before proposing the release.',
    command: './toad app validate my-app --context my-cloud --json', lines: ['Immutable image: pinned', 'Manifest + resource limits: valid', 'Update policy: start-first · rollback on failure'], view: { ...baseline, candidate: ['waiting', 'Manifest checked · waiting'] },
    status: 'Validated', report: 'The manifest passed. Nothing has been deployed by this validation.' },
  { speaker: 'OVER TO YOU', message: 'Ready to release v2 to my-app on my-cloud. I’ll wait for your approval, then watch the rollout and show you the result.',
    command: deploy, lines: ['Planned command · not started', 'Your brief asks the agent to wait for approval.', 'The existing v1 release keeps serving.'], view: baseline,
    status: 'Your call', report: 'In a real session, approval happens in your agent conversation. Here, give the demo a green light.' },
];
const deployment = {
  speaker: 'APPROVED · SHIPPING', message: 'Green light received. I’m releasing the pinned v2 image. Version one keeps serving while the replacement starts.',
  command: deploy, lines: ['Approved release: my-cloud / my-app', 'Deploy the reviewed, pinned image → verify', 'New task starting · delivery not verified yet'], view: rolling,
  status: 'Rolling out', report: 'Work is in progress. Observe the existing operation before retrying a release.',
};
const stories = {
  release: [...opening, deployment,
    { speaker: 'SHOW ME THE RECEIPTS', message: 'The service and running tasks match the requested v2 image. Two replicas are ready. One last check: the public HTTPS endpoint.',
      command: diagnose, lines: ['Requested digest = service digest = task digests', 'Ready replicas: 2/2 · v2', 'HTTPS probe: checking…'], view: { ...delivered, https: ['working', 'Checking…'] },
      status: 'Verifying', report: 'Running tasks are evidence. Delivery still needs the declared HTTPS checks to pass.' },
    { speaker: 'YOUR NEXT IDEA IS LIVE', message: 'Version two is running. Exact image, ready replicas, and HTTPS all match. Here’s the evidence; you can get back to building.',
      command: diagnose, lines: ['Requested release: v2 · verified', 'Ready replicas: 2/2 · HTTPS: 200', 'Result: deployed · no further mutation needed'], view: delivered,
      status: 'Verified', tone: 'success', report: 'v2 delivered. The requested image is running and all declared endpoint checks pass.' },
  ],
  rollback: [...opening, deployment,
    { speaker: 'THE HEALTH CHECK CAUGHT IT', message: 'The new task failed its health check. Swarm is restoring v1 under the configured rollback policy. I’m checking the recovered state.',
      command: diagnose, lines: ['Requested v2 task: unhealthy', 'Update state: rollback_completed', 'Current release: v1 · ready replicas: 2/2'], view: recovered,
      status: 'Rolled back', tone: 'warning', report: 'Availability recovered. This does not count as successful delivery of v2.' },
    { speaker: 'RECOVERED ≠ DELIVERED', message: 'Version one is serving again, but the v2 release failed. I’ll inspect the failure and review the Compose repair patch before another release.',
      command: './toad app logs my-app --context my-cloud --tail 50', lines: ['Service recovered on the previous image', 'Requested v2 release: failed', 'Next: inspect failure · review repair patch'], view: recovered,
      status: 'v2 failed', tone: 'warning', report: 'Keep the failure visible. Review the image repair patch before attempting the next release.' },
  ],
  unknown: [...opening, deployment,
    { speaker: 'I’VE LOST THE SIGNAL', message: 'The observation expired. The endpoint returns 200, but I can’t confirm the running image or current quorum. I won’t call this shipped.',
      command: observe, lines: ['Observation: expired · refresh required', 'Running digest + quorum: unknown', 'HTTPS: 200 · version not confirmed'], view: missing,
      status: 'Unknown', tone: 'unknown', report: 'Missing evidence stays unknown. An available endpoint is not release proof.' },
    { speaker: 'REFRESH BEFORE ACTING', message: 'I need a fresh observation through the intended operator access. I’ll inspect the current operation before deciding what happens next.',
      command: './toad operation status --context my-cloud --json', lines: ['Read-only next step: inspect current operation', 'Refresh the observation with intended access', 'Do not blindly start another deployment'], view: missing,
      status: 'Evidence needed', tone: 'unknown', report: 'Restore the intended read access and collect fresh evidence before another mutation.' },
  ],
};

const root = document.querySelector('[data-agent-view]');
if (root) {
  const find = name => root.querySelector(`[data-session-${name}]`);
  const text = (name, value) => { find(name).textContent = value; };
  const stepButtons = [...root.querySelectorAll('[data-session-step]')];
  const scenarioButtons = [...root.querySelectorAll('[data-scenario]')];
  const play = find('play');
  let scenario = 'release';
  let current = 0;
  let playing = false;
  let timer;

  function playbackControls() {
    const gate = current === 2;
    play.textContent = playing ? 'Pause' : gate ? 'Waiting for your call' : current === 5 ? 'Replay the story' : current === 0 ? 'Play the story' : 'Resume the story';
    play.disabled = gate;
    play.setAttribute('aria-pressed', String(playing));
    find('prev').disabled = current === 0;
    find('next').disabled = gate || current === 5;
    root.dataset.playing = String(playing);
  }
  function stop() {
    clearTimeout(timer); timer = undefined; playing = false;
    playbackControls();
  }
  function render() {
    const focused = document.activeElement;
    const step = stories[scenario][current];
    const view = step.view;
    root.dataset.tone = step.tone ?? 'neutral';
    for (const name of ['speaker', 'message', 'command', 'status', 'report']) text(name, step[name]);
    text('counter', `${String(current + 1).padStart(2, '0')} / 06`);
    text('quorum', view.quorum);
    text('observation', view.observation);
    text('map-note', view.note);
    text('traffic', view.route[1]);
    for (const name of ['current', 'candidate']) {
      find(name).dataset.state = view[name][0];
      text(`${name}-detail`, view[name][1]);
    }
    find('route').dataset.state = view.route[0];
    find('topology').dataset.flow = view.flow;
    find('quorum').closest('.session-quorum').dataset.state = view.flow === 'unknown' ? 'unknown' : 'healthy';
    for (const name of ['image', 'replicas', 'https']) {
      text(name, view[name][1]);
      root.querySelector(`[data-session-proof="${name}"]`).dataset.state = view[name][0];
    }
    find('output').replaceChildren(...step.lines.map(line => {
      const span = document.createElement('span'); span.textContent = line; return span;
    }));
    find('approval').hidden = current !== 2;
    stepButtons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === current));
      button.dataset.complete = String(index < current);
    });
    scenarioButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario)));
    text('feedback', '');
    if (current === 2 || current === 5) stop();
    playbackControls();
    if (current === 2 && (focused === play || focused === find('next'))) find('approve').focus({ preventScroll: true });
    else if ((current !== 2 && focused === find('approve')) || (current === 5 && focused === find('next'))) play.focus({ preventScroll: true });
  }
  function schedule() {
    if (!playing) return;
    timer = setTimeout(() => { current += 1; render(); schedule(); }, 4800);
  }
  function start() {
    document.dispatchEvent(new CustomEvent('toad:playback', { detail: 'agent-session' }));
    playing = true; render(); schedule();
  }
  function jump(index) { stop(); current = index; render(); }
  scenarioButtons.forEach(button => button.addEventListener('click', () => { scenario = button.dataset.scenario; jump(0); }));
  stepButtons.forEach((button, index) => button.addEventListener('click', () => jump(index)));
  find('prev').addEventListener('click', () => jump(Math.max(0, current - 1)));
  find('next').addEventListener('click', () => jump(Math.min(5, current + 1)));
  play.addEventListener('click', () => {
    if (playing) { stop(); return; }
    if (current === 5) current = 0;
    start();
  });
  find('approve').addEventListener('click', () => { current = 3; start(); });
  find('copy').addEventListener('click', async () => {
    stop();
    try { await navigator.clipboard.writeText(stories[scenario][current].command); text('feedback', 'Command copied. Use your own app and context names.'); }
    catch { text('feedback', 'Select the command above to copy it.'); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.addEventListener('toad:playback', event => { if (event.detail !== 'agent-session') stop(); });
  new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(root);
  render();
}
