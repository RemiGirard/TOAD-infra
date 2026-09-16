/** Validate the Conventional Commit subject used for squash merges and releases. */

const TYPES = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'] as const;
const SUBJECT = new RegExp(
  `^(?:${TYPES.join('|')})(?:\\([a-z0-9][a-z0-9._/-]*\\))?!?: [^\\s].+$`,
);

export function conventionalCommitError(subject: string): string | undefined {
  if (subject.includes('\n') || subject.includes('\r')) return 'the subject must be one line';
  if (subject.length > 100) return 'the subject must be at most 100 characters';
  if (!SUBJECT.test(subject)) {
    return `expected type(scope): summary; allowed types: ${TYPES.join(', ')}`;
  }
  return undefined;
}

function main(): void {
  const subject = process.env.TOAD_COMMIT_MESSAGE ?? process.argv.slice(2).filter((argument) => argument !== '--').join(' ');
  if (!subject) {
    console.error('Set TOAD_COMMIT_MESSAGE or pass a commit subject.');
    process.exitCode = 1;
    return;
  }
  const validationError = conventionalCommitError(subject);
  if (validationError) {
    console.error(`Invalid Conventional Commit subject: ${validationError}`);
    process.exitCode = 1;
    return;
  }
  console.log('Conventional Commit subject is valid.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
