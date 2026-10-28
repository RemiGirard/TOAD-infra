/** Generate a reviewable image-only rollback patch without modifying desired state. */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseDocument } from 'yaml';
import { imageDigest } from './app-runtime.js';

export function writeRollbackPatch(composePath: string, images: Record<string, string>, output?: string): string | undefined {
  const original = readFileSync(composePath, 'utf8');
  const document = parseDocument(original);
  let changed = false;
  for (const [service, image] of Object.entries(images)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(service) || !imageDigest(image)) throw new Error('Rollback patch requires declared service names and immutable image digests.');
    if (!document.hasIn(['services', service, 'image'])) throw new Error('Rollback patch service is absent from Compose.');
    if (document.getIn(['services', service, 'image']) !== image) {
      changed = true;
      document.setIn(['services', service, 'image'], image);
    }
  }
  if (!changed) return undefined;
  const noFinalNewline = !original.endsWith('\n');
  const modified = noFinalNewline ? document.toString().replace(/\n$/, '') : document.toString();
  const before = original.split('\n');
  const after = modified.split('\n');
  if (before.at(-1) === '') before.pop();
  if (after.at(-1) === '') after.pop();
  const filename = basename(composePath);
  if (/[\r\n\t]/.test(filename)) throw new Error('Compose path cannot be safely represented in a patch.');
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
  const start = Math.max(0, prefix - 3);
  const tail = Math.min(3, suffix);
  const removedEnd = before.length - suffix;
  const addedEnd = after.length - suffix;
  const lines: string[] = [];
  const append = (source: string[], from: number, to: number, marker: string): void => {
    for (let index = from; index < to; index += 1) {
      lines.push(`${marker}${source[index]}`);
      if (noFinalNewline && index === source.length - 1) lines.push('\\ No newline at end of file');
    }
  };
  append(before, start, prefix, ' ');
  append(before, prefix, removedEnd, '-');
  append(after, prefix, addedEnd, '+');
  append(before, removedEnd, removedEnd + tail, ' ');
  const patch = `--- a/${filename}\n+++ b/${filename}\n@@ -${start + 1},${removedEnd - start + tail} +${start + 1},${addedEnd - start + tail} @@\n${lines.join('\n')}\n`;
  const destination = output ? resolve(output) : `${composePath}.${randomUUID()}.rollback.patch`;
  if (resolve(destination) === resolve(composePath)) throw new Error('Rollback patch cannot replace Compose.');
  writeFileSync(destination, patch, { flag: 'wx', mode: 0o600 });
  return destination;
}
