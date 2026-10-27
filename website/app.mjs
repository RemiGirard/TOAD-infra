let profile = 'evaluation';
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
      if (current === steps.length - 1) current = 0;
      show(); play.textContent = 'Pause';
      timer = setInterval(() => { if (current === steps.length - 1) { stop(); return; } current += 1; show(); }, 5500);
    });
    show();
  } catch { title.textContent = 'The recorded run is unavailable. Open the first-app guide to follow the steps.'; }
}
walkthrough();
