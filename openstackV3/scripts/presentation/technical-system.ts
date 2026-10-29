/** Declared topology reviewed against e5a229b. Never reads operator files. */
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
type Signal = 'visit' | 'ship' | 'lookup' | 'watch';

function lines(value: string, limit: number): string[] {
  const result: string[] = []; let current = '';
  for (const word of value.split(' ')) {
    if (current && `${current} ${word}`.length > limit) { result.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
  }
  if (current) result.push(current);
  return result;
}
const text = (x: number, y: number, value: string, kind = 'tech-code', anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${kind}">${escape(value)}</text>`;
const wire = (path: string, kind: Signal = 'visit') => `<path d="${path}" class="map-arrow ${kind} tech-wire" marker-end="url(#evolving-${kind})"/>`;
const label = (x: number, y: number, value: string) => text(x, y, value, 'tech-wire-label', 'middle');
function box(id: string, x: number, y: number, width: number, height: number, title: string, detail: string[], kind: Signal = 'lookup'): string {
  const mini=width<100;
  const heading = lines(title, Math.floor((width - 24) / (mini?6:7.3)));
  const body = detail.flatMap(value => lines(value, Math.floor((width - 24) / (mini?5.8:6.8))));
  const start = 26 + heading.length * 17;
  return `<g transform="translate(${x} ${y})" data-tech-node="${id}"${mini?' class="tech-mini"':''}><rect width="${width}" height="${height}" rx="5" class="tech-box ${kind}"/>${heading.map((value,index)=>text(12,24+index*17,value,'tech-node-title')).join('')}${body.map((value,index)=>text(12,start+index*16,value)).join('')}</g>`;
}
function boundary(x: number, y: number, width: number, height: number, title: string, detail: string, kind = 'cloud'): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" class="tech-zone ${kind}"/>${text(x+15,y+25,title,'tech-zone-title')}${detail?text(x+15,y+46,detail,'tech-small'):''}`;
}

export const technicalSystemHeight = 2500;

export function renderTechnicalSystem(): string {
  const managers = [60,405,750].map((x,index) => {
    const first=index===0;
    return `<g data-tech-manager="manager-${index+1}">
${boundary(x,525,310,570,`NOVA / manager-${index+1}`,`10.0.0.${20+index} · az-${index+1} · ubuntu`,'host')}
<use href="/teaching-icons.svg#server" x="${x+265}" y="538" width="26" height="26"/>
${box(`engine-${index+1}`,x+14,593,282,72,'Docker Engine / Swarm manager',[`advertise: 10.0.0.${20+index} (private)`,'Raft quorum: 2 / 3 managers'],'ship')}
${first
  ? box('traefik-task',x+14,710,282,100,'traefik_traefik · replicas: 1',['node.role == manager','node.labels.toad.traefik-certificates == true','Swarm socket + file provider'],'visit')
  : box(`eligible-${index+1}`,x+14,710,282,94,'Application scheduling capacity',['Service replicas / constraints decide','No app placement is asserted here','No extra workers provisioned'],'ship')}
${first
  ? box('monitoring-owner',x+14,823,282,82,'toad.monitoring-state=true',['Prometheus / Loki / Grafana','Alertmanager / Blackbox: 1 task each'],'watch')
  : box(`private-join-${index+1}`,x+14,823,282,82,'Private manager connectivity',['SSH via manager-1 ProxyCommand','Joins as manager, not worker'],'lookup')}
${[0,1,2].map((collector,n)=>box(`collector-${index+1}-${collector}`,x+14+n*92,929,86,72,['node-exp','cAdvisor','Alloy'][n]!,[[':9100','host'],[':8080','containers'],[':12345','HTTP']][n]!,'watch')).join('')}
${text(x+15,1028,'Global: one collector task / eligible node','tech-small')}
${text(x+15,1050,first?'Node-local ACME + monitoring volumes':'Docker socket → Alloy log discovery','tech-small')}
${text(x+15,1073,'Local disk ≠ replicated application data','tech-small')}
</g>`;
  }).join('');

  return `<g data-map-section="topology" data-technical-system>
<rect x="8" y="0" width="1104" height="${technicalSystemHeight-20}" rx="12" class="tech-sheet"/>
${text(28,32,'TOAD / IMPLEMENTATION SCHEMATIC','tech-heading')}
${text(28,55,'Declared 3-manager IPv4 profile · source e5a229b · reserved example public IPs · not live health or task placement','tech-small')}
${text(1090,32,'CONTROL · DATA · TRUST · SIGNALS','tech-small','end')}

${box('browser',30,92,210,128,'Visitor / admin browser',['App: HTTPS :443','Admin: client certificate','DNS is a separate lookup'],'visit')}
${box('designate',275,92,260,128,'Designate / PRIMARY zone',['Parent NS → child nameservers','Zone TTL 300 s; apex + *. A TTL 60 s','A → app floating IP, not a proxy'],'lookup')}
${box('lb-control',570,92,260,128,'Octavia load-balancer resources',['TCP listeners :80 and :443','2 × ROUND_ROBIN pools','3 members / pool · no TLS offload'],'visit')}
${box('oci-registry',865,92,225,128,'Chosen OCI registry',['Buildx --push → digest','Engine pulls tag@sha256','Private pull auth: separate'],'ship')}
${wire('M240 130H272','lookup')}${wire('M275 180H243','lookup')}
${label(257,116,'DNS')}
${label(394,242,'HTTPS to the resolved floating IP')}
${wire('M700 220V274','lookup')}

${boundary(20,275,1080,1180,'INFOMANIAK PUBLIC CLOUD / OPENSTACK PROJECT','Heat declares Nova, Neutron, Octavia and Designate. ext-floating1 is the external network. Resources remain in your provider account.')}
${box('ssh-floating-ip',40,338,230,110,'SSH floating IP / manager-1',['198.51.100.20 (example)','TCP :22 ← operator CIDR','Ubuntu + project identity'],'ship')}
${box('security-groups',300,338,245,110,'Neutron security groups',['Tenant TCP 22/80/443/2377/7946','UDP 7946/4789 + ICMP','IPv4 egress → 0.0.0.0/0'],'lookup')}
${box('web-floating-ip',575,338,230,110,'App FIP → Octavia VIP',['198.51.100.30 (example)','TCP monitor: 10s / 5s / 3 retries','Transport proof only'],'visit')}
${box('neutron-router',835,338,240,110,'Neutron router / egress',['External gateway: ext-floating1','Subnet gateway 10.0.0.1','Resolvers 1.1.1.1 / 9.9.9.9'],'lookup')}
${wire('M135 220V249H1092V329H685V335','visit')}

${boundary(40,476,1040,643,'TENANT 10.0.0.0/24 / DOCKER SWARM · 3 MANAGERS · SOFT ANTI-AFFINITY','','swarm')}
${wire('M685 448V455H1088V514H215V522','visit')}${wire('M560 514V522','visit')}${wire('M905 514V522','visit')}
${label(560,453,'TCP 80/443 → any manager → ingress routing mesh')}
${wire('M155 448V459H34V600H57','ship')}${label(100,457,'SSH :22')}
${wire('M1080 550H1098V469H955V451','lookup')}${label(1018,462,'egress')}
${managers}
${wire('M370 629H402','ship')}${wire('M750 646H718V629','ship')}
${label(560,691,'TCP 2377 control · TCP/UDP 7946 discovery · UDP 4789 VXLAN')}
${wire('M1046 629H1106V242H978V223','ship')}${label(990,238,'OCI image pull')}

${boundary(40,1140,1040,280,'LOGICAL SERVICE / NETWORK VIEW — TASK PLACEMENT ABOVE IS NOT AN APP-REPLICA MAP','Overlay allocation: 10.20.0.0/16, /24 subnets. traefik-public is attachable; no encrypted flag or explicit MTU is declared.','network')}
${box('acme',65,1210,285,134,'Traefik configuration + local state',[':80 → :443 redirect; TLS ends here',':8080 ping / internal; :9100 metrics','Docker API 1.44 + opt-in labels','HTTP-01 / Infomaniak DNS-01','traefik-certificates: local ACME'],'visit')}
${box('app-tasks',420,1210,285,134,'APP STACK / Compose service → tasks',['traefik-public → HTTP :3000 example','image@sha256 + declared replicas','No published app ports / socket','Memory + no-new-privileges','Update failure → rollback policy'],'ship')}
${box('swarm-secrets',775,1210,285,150,'Secrets + optional application data',['age → SSH stdin → immutable secret','Content hash in Swarm secret name','Declared secret file mounts','Local volume → 1 pinned replica','node.labels.toad.stateful-primary == true','Backup policy explicit; none allowed'],'lookup')}
${wire('M356 757H385V1277H417','visit')}${label(400,1132,'Host / path → HTTP')}
${wire('M705 1287H772','lookup')}${label(740,1265,'files')}
${text(65,1380,'Traefik: stop-first / failure rollback; admin-mtls@file: RequireAndVerifyClientCert, min TLS1.2, strict SNI.','tech-code')}
${text(65,1403,'Watched /etc/traefik/dynamic.yaml + read-only manager socket. Socket / manager access remains root-equivalent.','tech-small')}

${boundary(20,1485,1080,590,'MONITORING STACK / INTERNAL OVERLAY + PROTECTED ADMIN ROUTES','Logical signal flow. Prometheus / Grafana / Alertmanager also join traefik-public. Loki and collectors have no public application route.','monitoring')}
${box('scrape-targets',40,1550,215,136,'DNS-discovered scrape targets',['tasks.node-exporter :9100','tasks.cadvisor :8080','tasks.traefik_traefik :9100','tasks.alloy :12345','tasks.loki :3100'],'watch')}
${box('prometheus',305,1550,245,136,'Prometheus :9090',['scrape / evaluation: 30s','retention: 7d / 5GB','Also self / Alertmanager / Blackbox','/api/v1/targets + /api/v1/alerts','HTTPS admin route: mTLS'],'watch')}
${box('blackbox',620,1550,200,136,'Blackbox :9115',['/probe: https_2xx','GET · redirect · SSL','IPv4 preferred · 10s','Bundled URLs only'],'watch')}
${box('probe-targets',880,1550,200,136,'Public HTTPS probe targets',['hello / whoami / root / www','Bundled platform URLs','Manifest app checks are separate'],'visit')}
${wire('M305 1614H258','watch')}${label(281,1604,'pull')}
${wire('M550 1614H617','watch')}${label(584,1604,'/probe')}
${wire('M820 1614H877','visit')}${label(848,1604,':443')}
${wire('M344 965H375V1125','watch')}${wire('M689 965H720V1125','watch')}${wire('M1034 965H1065V1125','watch')}
${wire('M1065 1125H30V1768H145V1787','watch')}${label(180,1117,'Alloy log streams / all nodes')}

${box('alloy-log-source',40,1790,215,134,'Alloy / global per node',['unix:///var/run/docker.sock','Docker discovery refresh: 5s','Container / service / stack labels','HTTP :12345 is not log input','Push /loki/api/v1/push'],'watch')}
${box('loki',305,1790,245,134,'Loki :3100 / log storage',['Filesystem TSDB; replication: 1','Retention: 168h; local volume','Internal monitoring overlay','Push writes; Grafana queries','No raw Loki logs in observe HTML'],'watch')}
${box('grafana',620,1790,200,134,'Grafana :3000',['Prometheus + Loki queries','File-provisioned config','CPU / memory / disk / HTTP','Logs / probes / freshness','Admin HTTPS: mTLS'],'watch')}
${box('alertmanager',880,1790,200,134,'Alertmanager :9093',['Prometheus rule alerts','Hosts / probes / certs','receiver: dashboard-only','No external destination','Admin HTTPS: mTLS'],'watch')}
${wire('M255 1850H302','watch')}${label(280,1840,'push')}
${wire('M620 1875H553','watch')}${label(586,1865,'query')}
${wire('M720 1790V1725H580V1645H553','watch')}${label(637,1715,'query :9090')}
${wire('M550 1660H565V1750H980V1787','watch')}${label(913,1740,'rules / firing alerts')}
${wire('M430 1686V1787','watch')}${label(487,1730,'scrape :3100')}
${['prometheus-data','loki-data','grafana-data','alertmanager-data','alloy-data'].map((name,index)=>`<g transform="translate(${40+index*210} 1965)"><use href="/teaching-icons.svg#database" width="24" height="24"/>${text(30,16,name,'tech-small')}</g>`).join('')}
${text(40,2025,'Prometheus / Loki / Grafana / Alertmanager / Blackbox: 1 task each, pinned to toad.monitoring-state=true.','tech-code')}
${text(40,2050,'Named volumes are node-local. Global collectors run on each eligible node. Notification delivery requires separate proof.','tech-small')}

${boundary(20,2125,1080,315,'OPERATOR / EXECUTION AND EVIDENCE CONTRACT','Local control paths cross APIs or SSH. This public illustration never executes commands or loads operator configuration.','operator')}
${box('operator-tools',40,2195,330,205,'TOAD / Node22 + pnpm + tsx',['OpenStack CLI: locked Python venv','Ansible: separate Python venv','Heat validate / create / update','ansible-playbook → inventory → SSH','ssh / ssh-keygen / OpenSSL / curl / tar','age: secret + backup inputs','rclone: configured offsite jobs'],'ship')}
${box('release-execution',395,2195,330,205,'Build / publish / deploy',['Allow-listed temporary build context','docker buildx build --platform … --push','containerimage.digest → Compose pin','Secrets installed before bundle transfer','docker stack deploy --prune -c … STACK','No --with-registry-auth forwarding','OCI operator does not bundle Buildx'],'ship')}
${box('release-evidence',750,2195,330,205,'observe / release proof / recovery',['SSH → service + running-task digests','Requested = service = task SHA-256','Running replicas + declared HTTPS checks','mTLS → Prometheus target / alert APIs','Private JSON / HTML expires after 60s','Unknown ≠ healthy; rollback ≠ new ship','Git + escrow + archives; restore proof'],'watch')}
${text(28,2456,'Read source-backed network, trust, monitoring and lifecycle specifications below. Pan the technical canvas; zoom up to 600%.','tech-small')}
${text(28,2473,'Green: control / artifacts · blue: request traffic · gray: lookup / policy · purple: signals. Line crossings are not junctions.','tech-small')}
</g>`;
}
