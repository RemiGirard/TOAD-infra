const examples = {
  ready: { title: 'The requested release is running.', state: 'Verified', detail: 'The service spec and running tasks match the expected image digest. Replicas and HTTPS checks passed.', stages: ['Read current state', 'Validate manifest', 'Deploy approved release', 'Verify digest + HTTPS', 'Explain the result'], next: 'Record the evidence. No further mutation is needed.' },
  deploying: { title: 'The agent is waiting for rollout.', state: 'Pending', detail: 'A new task is starting. The old version still serves traffic; delivery is not yet verified.', stages: ['Read current state ✓', 'Validate manifest ✓', 'Transfer approved files ✓', 'Wait for running tasks…', 'Verify digest + HTTPS next'], next: 'Inspect operation status. Wait for the existing operation before retrying.' },
  rollback: { title: 'Service recovered. New release failed.', state: 'Rolled back', detail: 'Swarm restored the old image after an unhealthy update. Availability has recovered; the requested new release was not delivered.', stages: ['Deploy requested image', 'Health check failed', 'Swarm rolled back', 'Verify recovered digest', 'Review the Compose repair patch'], next: 'Inspect the failure, then review the rollback patch before the next release.' },
  unknown: { title: 'The agent does not have enough evidence.', state: 'Unknown', detail: 'Monitoring could not be authenticated or this observation expired. The view does not infer health from missing data.', stages: ['Read current state', 'Collect available checks', 'Mark missing evidence', 'Request the exact missing access', 'Observe again before acting'], next: 'Restore the original operator identity or refresh the observation. Do not replace the CA.' }
};
const root = document.querySelector('[data-agent-view]');
if (root) {
  const buttons = [...root.querySelectorAll('[data-scenario]')];
  function select(key) {
    const value = examples[key]; if (!value) return;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === key)));
    root.querySelector('[data-state]').textContent = value.state;
    root.querySelector('[data-title]').textContent = value.title;
    root.querySelector('[data-detail]').textContent = value.detail;
    root.querySelector('[data-next]').textContent = value.next;
    root.querySelector('[data-stages]').replaceChildren(...value.stages.map(stage => { const item = document.createElement('li'); item.textContent = stage; return item; }));
  }
  buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.scenario)));
  select('deploying');
}
