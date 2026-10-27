/** Refresh reviewed public diagrams with an explicitly installed Mermaid CLI. */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT_DIR } from './infrastructure/paths.js';

export const diagramDocuments = [
  ['DEPLOYMENT', 'deployment', [
    'Public traffic through Octavia and Swarm to Traefik, applications, and protected admin services',
    'The operator CLI provisions Heat resources, configures hosts, deploys Swarm, updates DNS, and verifies the platform',
    'Parent and delegated child DNS zones point to Octavia; unrelated parent records are preserved',
    'First apply, one-time child DNS delegation, and subsequent declarative apply runs',
    'Application validation, deployment, convergence or rollback, and JSON diagnosis',
    'Git, operator identities, and encrypted backups are separate inputs to platform recovery',
  ]],
  ['OPERATIONS', 'operations', [
    'Observe health, identify the faulty layer, apply a narrow repair, and verify again',
    'Application states from validation to deployment, health, diagnosis, and rollback',
    'Quiesce a volume owner, stream and encrypt its archive, retain an independent copy, and explicitly restore',
  ]],
  ['DISASTER-RECOVERY', 'recovery', [
    'Rebuild infrastructure from Git and operator escrow, restore encrypted datasets, then verify data and services',
    'Proposed isolated recovery drill from objectives and a fresh stack through restore, evidence, and approved cleanup',
  ]],
] as const;

export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function diagramSources() {
  return diagramDocuments.flatMap(([document, slug, descriptions]) => {
    const markdown = readFileSync(resolve(ROOT_DIR, '../docs', `${document}.md`), 'utf8');
    const blocks = [...markdown.matchAll(/^```mermaid\r?\n([\s\S]*?)^```\s*$/gm)];
    if (blocks.length !== descriptions.length) throw new Error(`Review diagram descriptions for ${document}.`);
    return blocks.map((match, index) => ({
      file: `diagram-${slug}-${index + 1}.svg`,
      text: match[1]!.trim(),
      description: descriptions[index]!,
    }));
  });
}

function refresh() {
  const binary = process.argv[2];
  if (!binary) throw new Error('Usage: pnpm run site:diagrams -- /absolute/path/to/mmdc');
  const version = spawnSync(binary, ['--version'], { encoding: 'utf8' });
  if (version.status !== 0 || version.stdout.trim() !== '11.12.0') throw new Error('Use Mermaid CLI 11.12.0.');
  const temporary = mkdtempSync(join(tmpdir(), 'toad-diagrams-'));
  const source = resolve(ROOT_DIR, '../website');
  const records: Array<{ file: string; sourceHash: string; svgHash: string; mobile?: { file: string; svgHash: string } }> = [];
  try {
    const config = join(temporary, 'mermaid.json');
    writeFileSync(config, JSON.stringify({ securityLevel: 'strict', htmlLabels: false, theme: 'base', fontFamily: 'Arial, Helvetica, sans-serif',
      themeVariables: { primaryColor: '#e4ebd7', primaryTextColor: '#23362a', primaryBorderColor: '#8da077',
        lineColor: '#6e8556', secondaryColor: '#f9faf2', tertiaryColor: '#eef1e7', fontSize: '16px',
        actorBkg: '#e4ebd7', actorBorder: '#8da077', actorTextColor: '#23362a', signalColor: '#526847', signalTextColor: '#23362a' },
      flowchart: { htmlLabels: false, curve: 'linear', padding: 18 },
      sequence: { useMaxWidth: false, wrap: true },
    }));
    const browserArgs: string[] = [];
    if (process.env.TOAD_DIAGRAM_BROWSER) {
      const puppeteer = join(temporary, 'puppeteer.json');
      writeFileSync(puppeteer, JSON.stringify({ executablePath: process.env.TOAD_DIAGRAM_BROWSER }));
      browserArgs.push('--puppeteerConfigFile', puppeteer);
    }
    function render(text: string, file: string) {
      const input = join(temporary, 'diagram.mmd');
      const output = join(source, file);
      writeFileSync(input, text);
      const result = spawnSync(binary!, ['--input', input, '--output', output, '--configFile', config,
        '--backgroundColor', 'transparent', '--width', '1600', '--svgId', file.replace('.svg', ''), ...browserArgs], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`Cannot render ${file}: ${result.stderr}`);
      let svg = readFileSync(output, 'utf8');
      const dimensions = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/);
      if (!dimensions || dimensions.length !== 4) throw new Error(`Missing SVG dimensions: ${file}`);
      svg = svg.replace(/<svg\b[^>]*>/, (element) => element
        .replace(/\bwidth="[^"]*"/, `width="${dimensions[2]}"`)
        .replace(/\bheight="[^"]*"/, `height="${dimensions[3]}"`));
      writeFileSync(output, svg);
      return digest(svg);
    }
    for (const diagram of diagramSources()) {
      const svgHash = render(diagram.text, diagram.file);
      const mobileText = diagram.text.replace(/^flowchart LR\b/m, 'flowchart TD');
      const mobile = mobileText !== diagram.text ? { file: diagram.file.replace('.svg', '-mobile.svg'), svgHash: '' } : undefined;
      if (mobile) mobile.svgHash = render(mobileText, mobile.file);
      records.push({ file: diagram.file, sourceHash: digest(diagram.text), svgHash, ...(mobile ? { mobile } : {}) });
      console.log(`Rendered ${diagram.file}${mobile ? ' and mobile layout' : ''}.`);
    }
    writeFileSync(join(source, 'diagrams.json'), JSON.stringify(records, null, 2) + '\n');
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) refresh();
