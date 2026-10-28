/** Snapshot reviewed ordinary files before archiving; never follow source symlinks. */
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readSync, realpathSync, rmSync, writeSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

function safePath(path: string): boolean {
  return Boolean(path) && !isAbsolute(path) && !path.includes('\\')
    && !path.split('/').some(part => !part || part === '..' || part === 'credentials' || part.startsWith('.env'));
}

function ordinarySource(root: string, file: string) {
  if (!safePath(file)) throw new Error('Deployment files must be safe relative paths without credentials or dotenv files.');
  let current = root;
  let approved = lstatSync(root);
  const parts = file.split('/');
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error('Deployment files and their parent directories must be ordinary paths without symlinks.');
    }
    approved = stat;
  }
  const inside = relative(root, realpathSync(current));
  if (inside === '..' || inside.startsWith(`..${sep}`) || !safePath(inside)) throw new Error('Deployment file resolves outside its reviewed application boundary.');
  return { path: current, stat: approved };
}

export function stageAppFiles(directory: string, files: string[]) {
  const declaredRoot = resolve(directory);
  if (!lstatSync(declaredRoot).isDirectory() || lstatSync(declaredRoot).isSymbolicLink()) throw new Error('Application source must be an ordinary directory.');
  const root = realpathSync(declaredRoot);
  const staging = mkdtempSync(join(tmpdir(), 'toad-transfer-'));
  try {
    for (const file of files) {
      const source = ordinarySource(root, file);
      const input = openSync(source.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const before = fstatSync(input);
        if (!before.isFile() || before.dev !== source.stat.dev || before.ino !== source.stat.ino) throw new Error('Deployment file changed while being reviewed.');
        const target = join(staging, file);
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
        const output = openSync(target, 'wx', 0o640);
        try {
          const buffer = Buffer.alloc(64 * 1024);
          let total = 0;
          for (;;) {
            const count = readSync(input, buffer, 0, buffer.length, null);
            if (count === 0) break;
            total += count;
            if (total > before.size) throw new Error('Deployment file grew while being copied.');
            let written = 0;
            while (written < count) written += writeSync(output, buffer, written, count - written);
          }
          const after = fstatSync(input);
          if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error('Deployment file changed while being copied.');
        } finally { closeSync(output); }
      } finally { closeSync(input); }
    }
    return { directory: staging, cleanup: () => rmSync(staging, { recursive: true, force: true }) };
  } catch (cause) {
    rmSync(staging, { recursive: true, force: true });
    throw cause;
  }
}
