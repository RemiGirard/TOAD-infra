import { renderTechnicalSystem, technicalSystemHeight } from './technical-system.js';

/** Public, source-reviewed architecture. No operator configuration or live observations. */
type Point = [number, number];
type Kind = 'ship' | 'visit' | 'watch' | 'lookup';
type Component = { id: string; title: string; icon: string; lines: string[]; at: Point; phone: Point; kind?: Kind };
type Connection = { from: string; to: string; label: string; kind: Kind; side?: 'left' | 'right' };

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const wrap = (value: string, length: number): string[] => {
  const words = value.split(' '); const lines: string[] = []; let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > length) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
};

const tools: Component[] = [
  { id: 'source', title: 'Your app + coding agent', icon: 'laptop', at: [40,90], phone: [34,90], lines: ['App source stays in its own Git repo', 'TOAD: Heat, playbooks, app manifest'] },
  { id: 'cli', title: 'TOAD TypeScript CLI', icon: 'bot', at: [420,90], phone: [34,280], lines: ['Node 22+ · pnpm · tsx', 'Plans, invokes tools, records evidence'] },
  { id: 'context', title: 'Private operator context', icon: 'lock-keyhole', at: [800,90], phone: [34,470], lines: ['Cloud credentials · SSH · CA · age', 'Local private files; never site inputs'] },
  { id: 'openstack', title: 'OpenStack CLI', icon: 'cloud', at: [40,320], phone: [34,710], lines: ['Python venv + locked SDK clients', 'Heat / Keystone / Octavia / Designate', 'HTTPS to the provider APIs'] },
  { id: 'ansible', title: 'Ansible + OpenSSH', icon: 'server', at: [420,320], phone: [34,920], lines: ['Separate Python venv; playbooks', 'Generated inventory → SSH :22', 'manager-1 jumps to private managers'] },
  { id: 'buildx', title: 'Docker CLI + Buildx', icon: 'package', at: [800,320], phone: [34,1130], lines: ['Working local Docker daemon', 'Allow-listed build context only', 'Build, push, require SHA-256 digest'] },
];
const toolEdges: Connection[] = [
  {from:'source',to:'cli',label:'request / CLI',kind:'ship'},
  {from:'context',to:'cli',label:'local access',kind:'lookup'},
  {from:'cli',to:'openstack',label:'provision',kind:'ship'},
  {from:'cli',to:'ansible',label:'configure / deploy',kind:'ship'},
  {from:'cli',to:'buildx',label:'publish',kind:'ship'},
];

const runtime: Component[] = [
  { id: 'apis', title: 'OpenStack provider APIs', icon: 'cloud', at: [40,90], phone: [34,90], lines: ['Heat → Nova / Neutron / Octavia', 'Designate zone + wildcard A records', 'Creates resources in your account'] },
  { id: 'registry', title: 'Your chosen OCI registry', icon: 'package', at: [800,90], phone: [34,300], lines: ['Docker Buildx pushes the image', 'Compose pins image@sha256:…', 'Nodes pull; private auth is separate'] },
  { id: 'dns', title: 'Browser + DNS', icon: 'globe', at: [40,320], phone: [34,560], lines: ['Name → load-balancer public IPv4', 'DNS lookup, then HTTPS connection', 'Child zone needs parent delegation'] },
  { id: 'octavia', title: 'Octavia TCP entry', icon: 'cloud', at: [40,550], phone: [34,770], lines: ['Public FIP → private VIP', '80 / 443 → all three managers', 'TCP checks do not prove app health'] },
  { id: 'swarm', title: 'Docker Swarm managers', icon: 'server', at: [420,320], phone: [34,1030], lines: ['Private 10.0.0.0/24 · Raft quorum 2/3', 'TCP :2377 · TCP/UDP :7946', 'UDP :4789 · overlay pool 10.20.0.0/16'] },
  { id: 'docker-api', title: 'Swarm service state', icon: 'server', at: [800,320], phone: [34,1240], lines: ['Service specs, labels, tasks, secrets', 'Docker API through manager socket', 'Manager / socket access ≈ root'] },
  { id: 'traefik', title: 'Traefik · TLS + routing', icon: 'lock-keyhole', at: [420,550], phone: [34,1500], lines: ['1 pinned task · Swarm provider', 'Opt-in labels + watched dynamic file', 'TLS ends here; ACME volume is local'] },
  { id: 'app', title: 'Your app service / tasks', icon: 'app-window', at: [800,550], phone: [34,1710], lines: ['Digest + declared replicas + health', 'traefik-public overlay; internal :3000 example', 'No published app ports; rollback policy'] },
  { id: 'storage', title: 'Local state + secrets', icon: 'database', at: [800,780], phone: [34,1970], lines: ['Swarm secrets → declared file mounts', 'Local data: 1 replica, pinned primary', 'Explicit backup policy; no data replication'] },
];
const runtimeEdges: Connection[] = [
  {from:'apis',to:'swarm',label:'Heat resources',kind:'ship',side:'left'},
  {from:'swarm',to:'registry',label:'pull pinned image',kind:'ship'},
  {from:'dns',to:'octavia',label:'connect to the IP',kind:'visit'},
  {from:'octavia',to:'traefik',label:'Swarm ingress 80/443',kind:'visit'},
  {from:'swarm',to:'docker-api',label:'desired state',kind:'lookup'},
  {from:'docker-api',to:'traefik',label:'socket discovery',kind:'lookup'},
  {from:'traefik',to:'app',label:'HTTP on overlay',kind:'visit'},
  {from:'docker-api',to:'app',label:'schedule tasks',kind:'ship'},
  {from:'app',to:'storage',label:'mounted files',kind:'lookup'},
];

const monitoring: Component[] = [
  { id: 'collectors', title: 'On every eligible Swarm node', icon: 'server', at: [40,110], phone: [34,110], kind:'watch', lines: ['node-exporter :9100 → host metrics', 'cAdvisor :8080 → container metrics', 'Alloy → Docker socket logs; HTTP :12345'] },
  { id: 'prometheus', title: 'Prometheus :9090', icon: 'activity', at: [420,110], phone: [34,360], kind:'watch', lines: ['Pull / evaluate every 30 s', 'Retention: 7 days / 5 GB', 'Scrapes collectors + Traefik :9100', 'Also Loki, Alloy, Alertmanager, Blackbox'] },
  { id: 'blackbox', title: 'Blackbox exporter :9115', icon: 'globe', at: [800,110], phone: [34,610], kind:'watch', lines: ['Prometheus /probe → HTTPS GET', 'Bundled hello / whoami / root / www', 'SSL required · redirects · 10 s timeout'] },
  { id: 'alloy', title: 'Grafana Alloy · log pipeline', icon: 'server', at: [40,370], phone: [34,860], kind:'watch', lines: ['Local Docker socket → container logs', 'Discovery every 5 s; service / stack labels', 'Push /loki/api/v1/push over internal HTTP'] },
  { id: 'grafana', title: 'Grafana :3000', icon: 'activity', at: [420,370], phone: [34,1110], kind:'watch', lines: ['Queries Prometheus + Loki datasources', 'File-provisioned dashboard + datasources', 'CPU / memory / disk / HTTP / logs / freshness'] },
  { id: 'alerts', title: 'Alertmanager :9093', icon: 'activity', at: [800,370], phone: [34,1360], kind:'watch', lines: ['Prometheus rules → firing alerts', 'Targets / probes / CPU / disk / certificates', 'Default receiver: dashboard-only', 'External notifications need configuration'] },
  { id: 'loki', title: 'Loki :3100', icon: 'database', at: [40,630], phone: [34,1610], kind:'watch', lines: ['Receives logs; Grafana queries them', 'Filesystem · 168 h retention · replication 1', 'Internal overlay; no public Loki route'] },
  { id: 'admin', title: 'Your admin browser', icon: 'lock-keyhole', at: [420,630], phone: [34,1860], lines: ['HTTPS → Traefik client-certificate gate', 'Grafana / Prometheus / Alertmanager', 'App-user authentication is separate'] },
  { id: 'observe', title: 'TOAD observe → you + agent', icon: 'laptop', at: [800,630], phone: [34,2110], kind:'watch', lines: ['SSH: service + task digest / replicas', 'mTLS: Prometheus targets + alerts', 'Declared HTTPS checks + operation journal', 'Private JSON / HTML; expires after 60 s'] },
];
const monitoringEdges: Connection[] = [
  {from:'prometheus',to:'collectors',label:'pull metrics',kind:'watch'},
  {from:'prometheus',to:'blackbox',label:'request probe',kind:'watch'},
  {from:'collectors',to:'alloy',label:'logs detail',kind:'lookup'},
  {from:'alloy',to:'loki',label:'push logs',kind:'watch'},
  {from:'grafana',to:'prometheus',label:'query metrics',kind:'watch'},
  {from:'grafana',to:'loki',label:'query logs',kind:'watch'},
  {from:'prometheus',to:'alerts',label:'send alerts',kind:'watch'},
  {from:'admin',to:'grafana',label:'mTLS route',kind:'visit'},
  {from:'observe',to:'prometheus',label:'targets / alerts API',kind:'watch',side:'right'},
];

function renderPanel(key: string, title: string, subtitle: string, components: Component[], edges: Connection[], mobile: boolean, height: number, extras: string): string {
  const width = mobile ? 360 : 1120; const cardWidth = mobile ? 292 : 280;
  const point = (component: Component) => mobile ? component.phone : component.at;
  const geometry = new Map(components.map(component => {
    const [x,y] = point(component);
    const lines = component.lines.flatMap(line => wrap(line, mobile ? 42 : 40));
    return [component.id, {x,y,lines,height:Math.max(128,(component.id==='swarm'?124:64)+lines.length*18)}];
  }));
  const connections = edges.map((edge,index) => {
    const a=geometry.get(edge.from)!,b=geometry.get(edge.to)!;
    let d: string; let lx: number; let ly: number;
    if (mobile) {
      // Distinct side lanes keep return/query paths off the component text.
      const left = edge.side !== 'right' && index%2===0;
      const lane = left ? 8+Math.floor(index/2)*4 : 352-Math.floor(index/2)*4;
      const ax = left ? a.x : a.x+cardWidth;
      const bx = left ? b.x : b.x+cardWidth;
      const ay=a.y+55+(index%3)*17,by=b.y+55+(index%3)*17;
      d=`M${ax} ${ay}H${lane}V${by}H${bx+(left?-3:3)}`;
      return `<path d="${d}" class="map-arrow ${edge.kind} component-edge" marker-end="url(#evolving-${edge.kind})"/><text x="${left?27:333}" y="${ay-5}" class="component-port" text-anchor="middle">${index+1}</text><text x="${left?27:333}" y="${by-5}" class="component-port" text-anchor="middle">${index+1}</text>`;
    }
    if (a.y===b.y) {
      const right=b.x>a.x;
      d=`M${right?a.x+cardWidth:a.x} ${a.y+64}H${right?b.x-3:b.x+cardWidth+3}`;
      lx=(right?a.x+cardWidth+b.x:a.x+b.x+cardWidth)/2;ly=a.y+51;
    } else if (a.x===b.x) {
      const down=b.y>a.y;
      d=`M${a.x+cardWidth/2} ${down?a.y+a.height:a.y}V${down?b.y-3:b.y+b.height+3}`;
      lx=a.x+cardWidth/2+9;ly=(down?a.y+a.height+b.y:a.y+b.y+b.height)/2;
    } else {
      const down=b.y>a.y;
      const ay=down?a.y+a.height:a.y,by=down?b.y:b.y+b.height;
      const lane=ay+(down?1:-1)*(30+(index%3)*14);
      if (edge.side==='left') {
        const laneX=a.x+cardWidth+50;
        d=`M${a.x+cardWidth} ${a.y+64}H${laneX}V${b.y+64}H${b.x-3}`;lx=laneX;ly=b.y-18;
      } else if (edge.side==='right') {
        const returnY=b.y+b.height+65, returnX=b.x+cardWidth-30;
        d=`M${a.x+cardWidth} ${a.y+80}H1105V${returnY}H${returnX}V${b.y+b.height+3}`;lx=940;ly=returnY-6;
      } else {
        d=`M${a.x+cardWidth/2} ${ay}V${lane}H${b.x+cardWidth/2}V${by+(down?-3:3)}`;
        lx=(a.x+b.x+cardWidth)/2;ly=lane-6;
      }
    }
    const labelLines=wrap(edge.label,a.y===b.y?15:32);
    return `<path d="${d}" class="map-arrow ${edge.kind} component-edge" marker-end="url(#evolving-${edge.kind})"/><text x="${lx}" y="${ly-(labelLines.length-1)*13}" text-anchor="${a.x===b.x?'start':'middle'}" class="component-edge-label">${labelLines.map((line,index)=>`<tspan x="${lx}" dy="${index?13:0}">${escape(line)}</tspan>`).join('')}</text>`;
  }).join('');
  const cards = components.map(component => {
    const {x,y,lines,height:cardHeight}=geometry.get(component.id)!;
    const managers=component.id==='swarm'?[0,1,2].map(index=>`<g transform="translate(${47+index*(cardWidth-94)/2} 63)"><use href="/teaching-icons.svg#server" x="-14" y="-15" width="28" height="28"/><text y="32" text-anchor="middle" class="component-line">M${index+1} · .${20+index}</text></g>`).join(''):'';
    return `<g transform="translate(${x} ${y})" data-component="${component.id}"><rect width="${cardWidth}" height="${cardHeight}" rx="10" class="component-card ${component.kind??'ship'}"/><use href="/teaching-icons.svg#${component.icon}" x="15" y="16" width="25" height="25"/><text x="49" y="33" class="component-title">${escape(component.title)}</text>${managers}${lines.map((line,index)=>`<text x="15" y="${component.id==='swarm'?121:61}" dy="${index*18}" class="component-line">${escape(line)}</text>`).join('')}</g>`;
  }).join('');
  const legend = mobile ? `<text x="34" y="${height-edges.length*20-48}" class="component-kicker">FOLLOW THE NUMBERED CONNECTIONS</text>${edges.map((edge,index)=>`<text x="34" y="${height-edges.length*20-22+index*20}" class="component-line">${index+1} · ${escape(edge.label)}</text>`).join('')}` : '';
  const subtitleLines=mobile?wrap(subtitle.split(' · ')[0]!,44):[subtitle];
  return `<g data-map-section="${key}"><rect x="8" width="${width-16}" height="${height}" rx="16" class="component-panel"/><text x="28" y="34" class="branch-heading">${title}</text><text x="28" y="60" class="component-subtitle">${subtitleLines.map((line,index)=>`<tspan x="28" dy="${index?16:0}">${escape(line)}</tspan>`).join('')}</text>${extras}${connections}${cards}${legend}</g>`;
}

export function renderComponentMap(): string {
  const detailOffset=technicalSystemHeight+60;
  return `<g data-map-branch="components" data-reveal="expert" data-desktop-height="${2990+detailOffset}" data-mobile-height="${7050+detailOffset}">${renderTechnicalSystem()}<g transform="translate(0 ${detailOffset})">${[false,true].map(mobile => {
    const toolsHeight=mobile?1600:640, runtimeHeight=mobile?2500:1110, monitoringHeight=mobile?2710:1030;
    const runtimeY=toolsHeight+80, monitoringY=runtimeY+runtimeHeight+80;
    const note = (x:number,y:number,lines:string[]) => `<g class="component-note">${lines.map((line,index)=>`<text x="${x}" y="${y+index*20}" class="component-line">${escape(line)}</text>`).join('')}</g>`;
    const toolsExtra = mobile ? note(34,1360,['Also on the computer:','OpenSSL · curl · tar · ssh-keygen','age for encrypted inputs / backups','rclone for configured offsite jobs']) : note(40,526,['Local support tools: OpenSSL / ssh-keygen (admin PKI), curl (mTLS queries), tar (app transfer), age (encrypted inputs / backups).','Optional OCI operator bundles the venvs and support tools; Docker CLI / Buildx are not installed by that Dockerfile.','A workstation prerequisite is not a cloud-hosted TOAD service. No credentials are rendered in this model.']);
    const runtimeExtra = `${mobile?'':`<rect x="396" y="270" width="700" height="756" rx="18" class="component-swarm"/><text x="420" y="297" class="component-kicker">DOCKER SWARM · DECLARED SERVICES, NOT OBSERVED TASK PLACEMENT</text>`}${note(mobile?34:40,mobile?2170:973,mobile?['Swarm: overlay pool 10.20.0.0/16','traefik-public: attachable, not encrypted','One Traefik task + node-local ACME','Three managers protect quorum,','not every service or local volume.']:['Ansible over SSH → manager-1 → docker stack deploy --prune. The registry is a separate service you choose.','Image publication does not provision or deploy. Private pull authentication must be configured on the nodes.','Traefik uses the manager socket read-only; that mount still crosses a root-equivalent trust boundary.'])}`;
    const monitoringExtra = `${mobile?'':`<rect x="396" y="76" width="700" height="528" rx="18" class="component-state"/><text x="420" y="96" class="component-kicker">PROMETHEUS / GRAFANA / BLACKBOX / ALERTMANAGER: ONE PINNED TASK EACH</text>`}${note(mobile?34:40,mobile?2340:875,mobile?['Loki is also one pinned task.','All five use the monitoring-state node.','Named volumes remain node-local.','No external alert receiver by default.','Unknown / expired evidence ≠ healthy.']:['Loki also runs one pinned task. All five central services use the monitoring-state node; local volumes are not replicated.','Grafana panels: target / HTTPS health, alerts, HTTP rate / status, host CPU / memory / disk, logs and sample freshness.','observe does not export Loki logs or Grafana time series. Missing access is unknown; external alert delivery needs separate proof.'])}`;
    return `<g class="map-advanced-${mobile?'mobile':'desktop'} component-map">${renderPanel('workstation','10 / INSIDE YOUR COMPUTER','Local tools that TOAD orchestrates · source checkout and optional operator image',tools,toolEdges,mobile,toolsHeight,toolsExtra)}<path d="M${mobile?180:560} ${toolsHeight}V${runtimeY}" class="map-arrow ship" marker-end="url(#evolving-ship)"/><text x="${mobile?193:576}" y="${toolsHeight+42}" class="component-edge-label">APIs · SSH · image push</text><g transform="translate(0 ${runtimeY})">${renderPanel('swarm','YOUR CLOUD / DOCKER SWARM','Provider resources, registry and running services · public IPv4 profile; ports are declared defaults',runtime,runtimeEdges,mobile,runtimeHeight,runtimeExtra)}</g><path d="M${mobile?180:560} ${runtimeY+runtimeHeight}V${monitoringY}" class="map-arrow watch" marker-end="url(#evolving-watch)"/><text x="${mobile?193:576}" y="${runtimeY+runtimeHeight+42}" class="component-edge-label">metrics · logs · probes</text><g transform="translate(0 ${monitoringY})">${renderPanel('monitoring','MONITORING / EVERY SIGNAL HAS A PATH','Collectors, storage, dashboards, alerts and agent evidence · no live queries from this website',monitoring,monitoringEdges,mobile,monitoringHeight,monitoringExtra)}</g></g>`;
  }).join('')}</g></g>`;
}
