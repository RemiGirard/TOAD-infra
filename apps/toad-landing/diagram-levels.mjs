// One persistent public SVG scene; attributes only, compatible with the site's CSP.
const mix = (a, b, amount) => a + (b - a) * amount;
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const reveal = (value, layer) => {
  const [start, end] = { dns: [3, 12], https: [15, 24], cloud: [30, 36], delivery: [39, 48], runtime: [51, 60], network: [64, 72], trust: [75, 82], observe: [85, 92], expert: [94, 100] }[layer];
  return smooth((value - start) / (end - start));
};
const nearest = (stops, value) => stops.reduce((best, stop) => Math.abs(stop.at - value) < Math.abs(best.at - value) ? stop : best);
const fromUrl = stops => {
  const params = new URL(location.href).searchParams;
  const raw = params.get('detail');
  if (raw !== null && /^\d{1,3}$/.test(raw) && Number(raw) <= 100) return Number(raw);
  const key = ({ web: 'https', toad: 'runtime' })[params.get('level')] ?? params.get('level');
  return (stops.find(stop => stop.key === key) ?? stops[5]).at;
};

for (const root of document.querySelectorAll('[data-diagram-explorer]')) {
  const stops = [...root.querySelectorAll('[data-detail-stop]')].map(button => ({ at: Number(button.dataset.detailStop), key: button.dataset.stepKey, name: button.dataset.stepName, title: button.dataset.stepTitle, description: button.dataset.stepDescription }));
  const slider = root.querySelector('[data-detail-slider]');
  const svg = root.querySelector('[data-evolving-map]');
  const viewport = root.querySelector('[data-map-viewport]');
  const nodes = new Map([...svg.querySelectorAll('[data-map-node]')].map(node => [node.dataset.mapNode, node]));
  const paths = new Map([...svg.querySelectorAll('[data-map-path]')].map(path => [path.dataset.mapPath, path]));
  const layers = [...svg.querySelectorAll('[data-reveal], [data-conceal]')];
  const branches = [...svg.querySelectorAll('[data-map-branch]')];
  const branchPreparation = { network: [61, 64], trust: [73, 75], observe: [83, 85], expert: [93, 94] };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let target = fromUrl(stops);
  let current = target;
  let frame;
  let lastTime;
  let historyTimer;
  let mobile = viewport.clientWidth < 700;

  function draw(value) {
    const web = reveal(value, 'dns');
    const cloud = reveal(value, 'cloud');
    const toad = reveal(value, 'runtime');
    const delivery = reveal(value, 'delivery');
    // Make room just before the new parts arrive, so labels do not pile up mid-drag.
    const space = smooth((value - 24) / 8);
    const intro = 180 * (1 - space);
    const points = mobile ? {
      visitor: [mix(180, 85, web), 130 + 420 * space + intro], internet: [180, 340 + 430 * space + intro], app: [180, 580 + 960 * space + intro],
      dns: [270, 130 + 420 * space + intro], 'dns-detail': [180, 678], lock: [mix(230, 180, space), 455 + 855 * space + intro], entry: [180, 455 + 655 * space],
      agent: [85, 85], toad: [270, 85], package: [85, 310], managers: [180, 735 + 990 * space], monitor: [180, 900 + 1040 * space],
      'cloud-label': [180, 345 + 655 * space], 'other-paths': [180, 1100 + 1050 * space], 'return-label': [180, 730 + intro], 'route-label': [mix(85, 270, space), 475 + 435 * space + intro],
      'prepare-label': [264, 385], 'publish-label': [92, 230], 'deploy-label': [248, 565 + 895 * space],
      'ingress-label': [270, 1250], brief: [220, 220],
    } : {
      visitor: [110, 390], internet: [mix(455, 365, cloud), 390], app: [1000, 390], dns: [110, 235], 'dns-detail': [315, 272],
      lock: [mix(745, 795, toad), mix(350, 390, toad)], entry: [595, 390], agent: [110, 80], toad: [420, 80], package: [725, 80],
      managers: [795, 580], monitor: [795, 740], 'cloud-label': [795, 268], 'other-paths': [270, 590],
      'return-label': [555, 565], 'route-label': [mix(720, 462, toad), mix(300, 344, toad)],
      'prepare-label': [320, 225], 'publish-label': [573, 65], 'deploy-label': [1005, 212], 'ingress-label': [695, 334], brief: [555, 65],
    };
    for (const [name, [x, y]] of Object.entries(points)) nodes.get(name).setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    for (const node of layers) {
      const opacity = node.dataset.conceal ? 1 - reveal(value, node.dataset.conceal) : reveal(value, node.dataset.reveal);
      node.setAttribute('opacity', opacity.toFixed(4));
    }
    const p = (name, d, opacity) => {
      const path = paths.get(name);
      path.setAttribute('d', d);
      if (opacity !== undefined) path.setAttribute('opacity', opacity.toFixed(4));
    };
    const [vx, vy] = points.visitor;
    const [ix, iy] = points.internet;
    const [, ay] = points.app;
    const attrs = mobile ? { x: 16, y: 305 + 655 * space, width: 328, height: 450 + 450 * space } : { x: 515, y: 235, width: 580, height: 430 };
    for (const [name, number] of Object.entries(attrs)) svg.querySelector('[data-map-boundary]').setAttribute(name, number);
    if (mobile) {
      p('request', `M${vx} ${vy + 115}L180 ${iy - 65}`);
      p('simple-route', `M180 ${iy + 115}V${ay - 56}`, 1 - toad);
      p('return', `M125 ${ay}H28V${vy}H${vx - 55}`, 1 - cloud);
      p('simple-deploy', `M135 85H341V${ay}H235`, 1 - delivery);
      p('lookup-ask', `M${vx + 43} ${vy - 10}H226`);
      p('lookup-reply', `M226 ${vy + 15}H${vx + 43}`);
      const entryY = points.entry[1];
      const lockY = points.lock[1];
      p('public-route', `M180 ${iy + 115}H50V${entryY}H125`);
      p('gateway-route', `M180 ${entryY + 127}V${lockY - 57}`);
      p('app-route', `M180 ${lockY + 127}V${ay - 57}`);
      p('ask-agent', 'M135 85H220');
      p('publish', 'M270 203V240H85V263');
      p('prepare', `M320 95H341V${attrs.y - 20}H270V${attrs.y - 2}`);
      p('deploy', `M85 412V440H28V${ay - 5}H125`);
      p('observe', `M180 ${attrs.y + attrs.height + 3}V${points.monitor[1] - 35}`);
      const height = mix(mix(790, 830, web) + intro, mix(2090, 2300, reveal(value, 'network')), space);
      svg.setAttribute('viewBox', `0 0 360 ${height.toFixed(2)}`);
      svg.setAttribute('width', '360');
      svg.setAttribute('height', height.toFixed(2));
    } else {
      p('request', `M172 390H${ix - 67}`);
      p('simple-route', `M${ix + 67} 390H944`, 1 - toad);
      p('return', 'M1000 520V580H110V520', 1 - cloud);
      p('simple-deploy', 'M165 80H1000V334', 1 - delivery);
      p('lookup-ask', 'M85 335V293');
      p('lookup-reply', 'M135 293V335');
      p('public-route', `M${ix + 67} 390H540`);
      p('gateway-route', 'M650 390H740');
      p('app-route', 'M850 390H944');
      p('ask-agent', 'M165 80H365');
      p('publish', 'M475 80H670');
      p('prepare', 'M420 201V230H595V234');
      p('deploy', 'M780 80H1080V320H1000V334');
      p('observe', 'M795 680V703');
      const top = 0;
      const height = mix(640, 880, space);
      svg.setAttribute('viewBox', `0 ${top.toFixed(2)} 1120 ${height.toFixed(2)}`);
      svg.setAttribute('width', '1120');
      svg.setAttribute('height', height.toFixed(2));
    }
    // Each branch gets its full space before it fades in. Earlier nodes never get replaced.
    svg.dataset.layout = mobile ? 'mobile' : 'desktop';
    let height = Number(svg.getAttribute('height'));
    let nextY = (mobile ? 2300 : 880) + 60;
    let previous;
    let spine = mobile ? 'M344 1863V2320H180V2360' : 'M1098 665H1105V910H560V940';
    for (const branch of branches) {
      const branchHeight = Number(mobile ? branch.dataset.mobileHeight : branch.dataset.desktopHeight);
      branch.setAttribute('transform', `translate(0 ${nextY})`);
      const [start, end] = branchPreparation[branch.dataset.reveal];
      const open = smooth((value - start) / (end - start));
      if (open > 0) height = Math.max(height, nextY + branchHeight * open + 40);
      if (previous) spine += ` M${mobile ? 180 : 560} ${previous}V${nextY}`;
      previous = nextY + branchHeight * open - 16;
      nextY += (branchHeight + 60) * open;
    }
    svg.querySelector('[data-map-spine]').setAttribute('d', spine);
    const top = svg.getAttribute('viewBox').split(' ')[1];
    svg.setAttribute('height', height.toFixed(2));
    svg.setAttribute('viewBox', `0 ${top} ${mobile ? 360 : 1120} ${height.toFixed(2)}`);
    nodes.get('return-label').setAttribute('opacity', (1 - cloud).toFixed(4));
    svg.dataset.renderedDetail = value.toFixed(2);
  }

  function tick(time) {
    const elapsed = lastTime === undefined ? 16 : Math.min(64, time - lastTime);
    lastTime = time;
    current = mix(current, target, 1 - Math.exp(-elapsed / 180));
    if (Math.abs(current - target) < .02) current = target;
    draw(current);
    if (current !== target) frame = requestAnimationFrame(tick);
    else { frame = undefined; lastTime = undefined; }
  }
  function set(value, immediate = false) {
    const previousTarget = target;
    target = Math.max(0, Math.min(100, value));
    if (previousTarget >= 64 && target < 64) viewport.scrollTo({ top: 0, left: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
    slider.value = String(target);
    const stop = nearest(stops, target);
    const stepIndex = stops.indexOf(stop);
    root.querySelector('[data-level-status]').textContent = `${String(stepIndex + 1).padStart(2, '0')} / ${stops.length} · ${stop.name}`;
    slider.setAttribute('aria-valuetext', `Step ${stepIndex + 1} of ${stops.length}: ${stop.name}, ${target}% detail`);
    for (const button of root.querySelectorAll('[data-detail-stop]')) button.setAttribute('aria-pressed', String(Number(button.dataset.detailStop) === stop.at));
    root.querySelector('[data-scene-title]').textContent = stop.title;
    root.querySelector('[data-scene-description]').textContent = stop.description;
    svg.querySelector('desc').textContent = `${stop.description} Teaching model, not live health or placement.`;
    const branch = branches.find(branch => branch.dataset.mapBranch === (stop.key === 'expert' ? 'components' : stop.key));
    root.querySelector('[data-view-step]').hidden = !branch;
    root.querySelector('[data-view-overview]').hidden = !branch;
    root.querySelector('[data-view-step]').textContent = stop.key === 'expert' ? 'View components ↓' : `View ${stop.name.toLowerCase()} ↓`;
    root.querySelector('[data-component-tools]').hidden = target < 94;
    const url = new URL(location.href);
    url.searchParams.set('level', stop.key);
    if (target === stop.at) url.searchParams.delete('detail');
    else url.searchParams.set('detail', String(target));
    url.hash = 'whole-picture';
    root.querySelector('[data-level-link]').href = url.href;
    if (immediate || reduced.matches) {
      cancelAnimationFrame(frame);
      frame = undefined; lastTime = undefined; current = target;
      draw(current);
    } else if (frame === undefined) frame = requestAnimationFrame(tick);
  }
  function remember() {
    const url = root.querySelector('[data-level-link]').href;
    if (url !== location.href) history.pushState(null, '', url);
  }
  slider.addEventListener('input', () => set(Number(slider.value)));
  // A held arrow key emits many changes. Save the settled adjustment as one entry.
  slider.addEventListener('change', () => { clearTimeout(historyTimer); historyTimer = setTimeout(remember, 450); });
  for (const button of root.querySelectorAll('[data-detail-stop]')) button.addEventListener('click', () => { clearTimeout(historyTimer); set(Number(button.dataset.detailStop)); remember(); });
  addEventListener('popstate', () => { clearTimeout(historyTimer); set(fromUrl(stops), true); });
  reduced.addEventListener('change', () => { if (reduced.matches) set(target, true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) set(target, true); });
  new ResizeObserver(() => {
    const next = viewport.clientWidth < 700;
    if (next !== mobile) { mobile = next; set(target, true); }
  }).observe(viewport);
  const zooms = [100, 125, 150, 200, 250];
  let zoomIndex = 0;
  function zoom(index) {
    const previous = zooms[zoomIndex];
    const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
    const centerY = viewport.scrollTop + viewport.clientHeight / 2;
    zoomIndex = Math.max(0, Math.min(zooms.length - 1, index));
    viewport.dataset.zoom = String(zooms[zoomIndex]);
    const ratio = zooms[zoomIndex] / previous;
    viewport.scrollLeft = centerX * ratio - viewport.clientWidth / 2;
    viewport.scrollTop = centerY * ratio - viewport.clientHeight / 2;
    root.querySelector('[data-zoom-label]').textContent = `${zooms[zoomIndex]}%`;
    root.querySelector('[data-zoom-out]').disabled = zoomIndex === 0;
    root.querySelector('[data-zoom-in]').disabled = zoomIndex === zooms.length - 1;
  }
  root.querySelector('[data-zoom-in]').addEventListener('click', () => zoom(zoomIndex + 1));
  root.querySelector('[data-zoom-out]').addEventListener('click', () => zoom(zoomIndex - 1));
  root.querySelector('[data-zoom-fit]').addEventListener('click', () => { zoom(0); viewport.scrollLeft = 0; });
  root.querySelector('[data-view-step]').addEventListener('click', () => {
    set(target, true);
    const key = nearest(stops, target).key;
    const branch = branches.find(branch => branch.dataset.mapBranch === (key === 'expert' ? 'components' : key));
    if (!branch) return;
    const top = branch.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - 8;
    viewport.scrollTo({ top, left: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
  });
  for (const button of root.querySelectorAll('[data-component-jump]')) button.addEventListener('click', () => {
    set(100, true);
    remember();
    const section = svg.querySelector(`.map-advanced-${mobile ? 'mobile' : 'desktop'} [data-map-section="${button.dataset.componentJump}"]`);
    const top = section.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - 8;
    viewport.scrollTo({ top, left: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
  });
  root.querySelector('[data-view-overview]').addEventListener('click', () => viewport.scrollTo({ top: 0, left: 0, behavior: reduced.matches ? 'instant' : 'smooth' }));
  const expand = root.querySelector('[data-expand-expert]');
  const chapters = [...root.querySelectorAll('.expert-chapter')];
  function syncExpansion() {
    const all = chapters.every(chapter => chapter.open);
    expand.setAttribute('aria-expanded', String(all));
    expand.textContent = all ? 'Collapse all details' : 'Expand all details';
  }
  for (const chapter of chapters) chapter.addEventListener('toggle', syncExpansion);
  expand.addEventListener('click', () => { const open = !chapters.every(chapter => chapter.open); for (const chapter of chapters) chapter.open = open; syncExpansion(); });
  set(target, true);
  zoom(0);
  root.querySelector('[data-static-overview]').hidden = true;
  svg.removeAttribute('hidden');
  root.querySelector('[data-level-controls]').hidden = false;
  root.querySelector('[data-map-tools]').hidden = false;
  root.querySelector('[data-level-link]').hidden = false;
  expand.hidden = false;
}
