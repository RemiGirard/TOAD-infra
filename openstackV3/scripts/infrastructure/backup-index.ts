/** Parse a platform backup index without permitting path traversal. */

import { basename, dirname, isAbsolute, resolve } from 'node:path';

export interface BackupIndexArchive {
  dataset: string;
  file: string;
  sha256: string;
}

export interface BackupIndex {
  version: 1;
  createdAt: string;
  archives: BackupIndexArchive[];
}

export interface ResolvedBackupArchive extends BackupIndexArchive {
  path: string;
}

export function parseBackupIndex(contents: string, indexPath: string): { index: BackupIndex; archives: ResolvedBackupArchive[] } {
  const value = JSON.parse(contents) as Partial<BackupIndex>;
  if (value.version !== 1 || typeof value.createdAt !== 'string' || !Array.isArray(value.archives)) {
    throw new Error('Backup index must use schema version 1 and contain createdAt plus archives.');
  }
  const directory = dirname(resolve(indexPath));
  const archives = value.archives.map((archive) => {
    if (!archive || typeof archive.dataset !== 'string' || typeof archive.file !== 'string'
      || !/^[a-f0-9]{64}$/.test(archive.sha256 ?? '')) {
      throw new Error('Backup index contains an invalid archive entry.');
    }
    let path = resolve(directory, archive.file);
    // Version-1 indexes originally stored absolute paths. Relocate those by
    // basename so an entire encrypted backup directory remains portable.
    if (dirname(path) !== directory && isAbsolute(archive.file)) path = resolve(directory, basename(archive.file));
    if (dirname(path) !== directory) throw new Error('Backup archives must be stored beside their index.');
    return { dataset: archive.dataset, file: archive.file, sha256: archive.sha256!, path };
  });
  if (archives.length === 0) throw new Error('Backup index contains no archives.');
  return { index: value as BackupIndex, archives };
}
