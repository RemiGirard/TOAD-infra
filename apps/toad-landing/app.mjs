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
      if (current === steps.length - 1) current = 0;
      show(); play.textContent = 'Pause';
      timer = setInterval(() => { if (current === steps.length - 1) { stop(); return; } current += 1; show(); }, 5500);
    });
    show();
  } catch { title.textContent = 'The recorded run is unavailable. Open the first-app guide to follow the steps.'; }
}
walkthrough();

const usage = document.querySelector('[data-usage-preview]');
if (usage) {
  const tabs = [...usage.querySelectorAll('[role="tab"]')];
  function selectUsage(tab) {
    for (const candidate of tabs) {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      document.getElementById(candidate.getAttribute('aria-controls')).hidden = !selected;
    }
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => selectUsage(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      else if (event.key === 'ArrowLeft') next = tabs[(index + tabs.length - 1) % tabs.length];
      else if (event.key === 'Home') next = tabs[0];
      else if (event.key === 'End') next = tabs[tabs.length - 1];
      if (next) { event.preventDefault(); selectUsage(next); next.focus(); }
    });
  }
  usage.querySelector('[data-copy-agent-brief]').addEventListener('click', async () => {
    const feedback = usage.querySelector('[data-copy-feedback]');
    try {
      await navigator.clipboard.writeText(usage.querySelector('#agent-brief-text').textContent);
      feedback.textContent = 'Brief copied.';
    } catch { feedback.textContent = 'Select the brief above to copy it.'; }
  });
}
