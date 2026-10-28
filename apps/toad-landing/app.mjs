let profile = 'production';
const price = document.querySelector('#node-price');
const total = document.querySelector('#cost-total');
const breakdown = document.querySelector('#cost-breakdown');
function calculate() {
  if (!price || !total) return;
  const nodePrice = Math.max(0, Number(price.value) || 0);
  const production = profile === 'production';
  total.textContent = `CHF ${(nodePrice * (production ? 3 : 1) + 3.34 * (production ? 2 : 1) + (production ? 10 : 0)).toFixed(2)}`;
  breakdown.textContent = production ? '3 nodes + 2 reserved IPv4s + 1 load balancer' : '1 node + 1 reserved IPv4';
}
for (const button of document.querySelectorAll('[data-profile]')) button.addEventListener('click', () => {
  profile = button.dataset.profile;
  for (const candidate of document.querySelectorAll('[data-profile]')) candidate.setAttribute('aria-pressed', String(candidate === button));
  calculate();
});
price?.addEventListener('input', calculate);
calculate();

async function walkthrough() {
  const title = document.querySelector('#run-title');
  if (!title) return;
  try {
    const response = await fetch('/walkthrough.json');
    if (!response.ok) throw new Error('Record unavailable');
    const record = await response.json();
    const steps = record.steps;
    let current = 0;
    let timer;
    const previous = document.querySelector('#run-prev');
    const next = document.querySelector('#run-next');
    const play = document.querySelector('#run-play');
    function stop() { clearInterval(timer); timer = undefined; play.textContent = 'Play walkthrough'; }
    function show() {
      const step = steps[current];
      title.textContent = step.title;
      document.querySelector('#run-counter').textContent = `STEP ${current + 1} / ${steps.length}`;
      document.querySelector('#run-command').textContent = step.command;
      document.querySelector('#run-result').textContent = step.result;
      document.querySelector('#run-time').textContent = step.recordedAt ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(step.recordedAt)) + ' PARIS' : 'RECORDED RESULT';
      previous.disabled = current === 0;
      next.disabled = current === steps.length - 1;
    }
    previous.addEventListener('click', () => { stop(); current = Math.max(0, current - 1); show(); });
    next.addEventListener('click', () => { stop(); current = Math.min(steps.length - 1, current + 1); show(); });
    play.disabled = false;
    play.addEventListener('click', () => {
      if (timer) { stop(); return; }
      document.dispatchEvent(new CustomEvent('toad:playback', { detail: 'recorded-run' }));
      if (current === steps.length - 1) current = 0;
      show(); play.textContent = 'Pause';
      timer = setInterval(() => { if (current === steps.length - 1) { stop(); return; } current += 1; show(); }, 5500);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    document.addEventListener('toad:playback', event => { if (event.detail !== 'recorded-run') stop(); });
    show();
  } catch { title.textContent = 'The recorded run is unavailable. Open the first-app guide to follow the steps.'; }
}
walkthrough();

const duet = document.querySelector('[data-deploy-duet]');
if (duet) {
  const brief = duet.querySelector('[data-duet-message]').textContent;
  const beats = [
    { key: 'plan', speaker: 'YOUR BRIEF', message: brief,
      caption: 'First, a read-only plan.', command: './toad cloud plan my-cloud --context my-cloud --json',
      output: '{ "changes": false,\n  "resources": { "managers": 3, "loadBalancers": 1 } }',
      result: 'Your cloud. Your call.', detail: 'Type the command, or let your agent take the next step.' },
    { key: 'inspect', speaker: 'AGENT → YOU', message: 'Let me read the room: the target cloud, the running app, and any gaps in the evidence.',
      caption: 'Your agent uses the same CLI you do.', command: './toad observe --app my-app --context my-cloud --json',
      output: '// quorum · image digests · HTTPS · metrics\n// one timestamped observation, shared with you',
      result: 'Same view. Same understanding.', detail: 'You can inspect the private operation view alongside your agent.' },
    { key: 'approve', speaker: 'AGENT → YOU', message: 'Here’s the plan. Shall I apply my-cloud and then release my-app? You give the green light.',
      caption: 'Planned next command — after your approval.', command: './toad cloud apply my-cloud --context my-cloud',
      output: '// approval happens in your agent conversation\n// then: Heat → Ansible → Swarm → HTTPS',
      result: 'You’re still at the wheel.', detail: 'The starter brief asks your agent to wait before making changes.' },
    { key: 'ship', speaker: 'AGENT → YOU', message: 'Green light received. I’ll ship the pinned image and check what actually runs. You keep building.',
      caption: 'A few extra hands. One familiar command.', command: './toad app release my-app --context my-cloud',
      output: 'build → pin → deploy → verify\nimage@sha256:8a4d…',
      result: 'A little teamwork. A real release.', detail: 'The CLI checks the requested image against the service and running tasks.' },
    { key: 'verify', speaker: 'AGENT → YOU', message: 'Shipped. Here are the receipts: the requested image is running, replicas are ready, and HTTPS passes.',
      caption: 'The result comes with evidence.', command: './toad app diagnose my-app --context my-cloud --json',
      output: '{ "ok": true, "outcome": "deployed",\n  "services": [{ "running": 2, "desired": 2 }] }',
      result: 'Hello, your next idea.', detail: 'my-app.your-domain.dev · exact image · ready replicas · HTTPS' }
  ];
  const buttons = [...duet.querySelectorAll('[data-duet-step]')];
  const play = duet.querySelector('[data-duet-play]');
  let current = 0;
  let timer;
  function show(index) {
    current = index;
    const beat = beats[current];
    duet.dataset.beat = beat.key;
    for (const [selector, value] of [
      ['[data-duet-speaker]', beat.speaker], ['[data-duet-message]', beat.message],
      ['[data-duet-caption]', beat.caption], ['[data-duet-command]', beat.command],
      ['[data-duet-output]', beat.output], ['[data-duet-result]', beat.result],
      ['[data-duet-result-detail]', beat.detail], ['[data-duet-count]', `0${current + 1} / 05`]
    ]) duet.querySelector(selector).textContent = value;
    buttons.forEach((button, at) => button.setAttribute('aria-pressed', String(at === current)));
    duet.querySelector('[data-duet-feedback]').textContent = '';
  }
  function stop() {
    clearInterval(timer); timer = undefined; duet.dataset.playing = 'false';
    play.textContent = 'Play the handoff'; play.setAttribute('aria-pressed', 'false');
  }
  buttons.forEach((button, at) => button.addEventListener('click', () => { stop(); show(at); }));
  play.addEventListener('click', () => {
    if (timer) { stop(); return; }
    document.dispatchEvent(new CustomEvent('toad:playback', { detail: 'duet' }));
    if (current === beats.length - 1) show(0);
    duet.dataset.playing = 'true'; play.textContent = 'Pause'; play.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => { if (current === beats.length - 1) { stop(); return; } show(current + 1); }, 5000);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.addEventListener('toad:playback', event => { if (event.detail !== 'duet') stop(); });
  async function copy(value, message, resetToBrief = false) {
    const feedback = duet.querySelector('[data-duet-feedback]');
    try { await navigator.clipboard.writeText(value); feedback.textContent = message; }
    catch { if (resetToBrief) show(0); feedback.textContent = 'Select the text above to copy it.'; }
  }
  duet.querySelector('[data-copy-brief]').addEventListener('click', () => copy(brief, 'Starter brief copied.', true));
  duet.querySelector('[data-copy-command]').addEventListener('click', () => copy(beats[current].command, 'Command copied.'));
  show(0);
}
