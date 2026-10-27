const button = document.querySelector('#refresh');
async function refresh() {
  button.disabled = true;
  try {
    const response = await fetch(new URL('api/info', import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = await response.json();
    document.querySelector('#status').textContent = 'Your API is responding';
    for (const key of ['message', 'version', 'runtime']) document.querySelector(`#${key}`).textContent = info[key];
    document.querySelector('#uptime').textContent = `${info.uptimeSeconds}s`;
  } catch {
    document.querySelector('#status').textContent = 'API unavailable. Try again or run app diagnose.';
  } finally { button.disabled = false; }
}
button.addEventListener('click', refresh);
refresh();
