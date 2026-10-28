// Local presentation state only. No cloud calls, commands or private observations.
for (const root of document.querySelectorAll('[data-diagram-explorer]')) {
  const tabs = [...root.querySelectorAll('[data-diagram-level]')];
  const keys = tabs.map(tab => tab.dataset.diagramLevel);
  const labels = ['Just the idea', 'Web basics', 'TOAD platform', 'Expert implementation'];
  function select(key, updateUrl = false) {
    if (!keys.includes(key)) key = 'toad';
    const index = keys.indexOf(key);
    root.dataset.currentLevel = key;
    for (const tab of tabs) {
      const selected = tab.dataset.diagramLevel === key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of root.querySelectorAll('[data-diagram-panel]')) panel.hidden = panel.dataset.diagramPanel !== key;
    root.querySelector('[data-level-status]').textContent = `Level ${index + 1} of 4 · ${labels[index]}`;
    const url = new URL(location.href);
    url.searchParams.set('level', key);
    url.hash = 'whole-picture';
    root.querySelector('[data-level-link]').href = url.href;
    if (updateUrl && url.href !== location.href) history.pushState(null, '', url);
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => select(tab.dataset.diagramLevel, true));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      tabs[next].focus();
      select(tabs[next].dataset.diagramLevel, true);
    });
  }
  const expand = root.querySelector('[data-expand-expert]');
  const chapters = [...root.querySelectorAll('.expert-chapter')];
  function syncExpansion() {
    const allOpen = chapters.every(chapter => chapter.open);
    expand.setAttribute('aria-expanded', String(allOpen));
    expand.textContent = allOpen ? 'Collapse all details' : 'Expand all details';
  }
  for (const chapter of chapters) chapter.addEventListener('toggle', syncExpansion);
  expand.addEventListener('click', () => {
    const open = !chapters.every(chapter => chapter.open);
    for (const chapter of chapters) chapter.open = open;
    syncExpansion();
  });
  const fit = root.querySelector('[data-fit-map]');
  fit.addEventListener('click', () => {
    const pressed = fit.getAttribute('aria-pressed') !== 'true';
    fit.setAttribute('aria-pressed', String(pressed));
    fit.textContent = pressed ? 'Show topology at actual size' : 'Fit topology to screen';
    root.querySelector('[data-expert-content]').dataset.mapFit = String(pressed);
  });
  addEventListener('popstate', () => select(new URL(location.href).searchParams.get('level')));
  select(new URL(location.href).searchParams.get('level'));
  root.querySelector('[data-level-controls]').hidden = false;
  root.querySelector('[data-level-help]').hidden = false;
}
