/** Ensure a Nova keypair belongs to this operator before provisioning hosts. */
type KeypairCli = (args: string[]) => string;

function publicIdentity(value: string): string {
  const [algorithm, key] = value.trim().split(/\s+/);
  if (!algorithm || !/^(ssh-|ecdsa-sha2-|sk-)/.test(algorithm) || !key || !/^[A-Za-z0-9+/]+=*$/.test(key)) {
    throw new Error('Cannot read a valid SSH public key. Run setup with the intended operator context.');
  }
  return `${algorithm} ${key}`;
}

export function ensureCloudKeypair(name: string, publicKeyPath: string, localPublicKey: string, cli: KeypairCli): 'created' | 'existing' {
  const identity = publicIdentity(localPublicKey);
  const records: unknown = JSON.parse(cli(['keypair', 'list', '-f', 'json']));
  if (!Array.isArray(records)) throw new Error('Cannot list OpenStack keypairs. Run pnpm run doctor -- --cloud before setup.');
  const exists = records.some((record) => record?.Name === name || record?.name === name);
  if (!exists) cli(['keypair', 'create', '--public-key', publicKeyPath, name]);
  const remote = cli(['keypair', 'show', name, '--public-key']);
  if (publicIdentity(remote) !== identity) {
    throw new Error(`Cloud keypair "${name}" does not match this context's SSH key. Use the matching operator context or a separate cloud project; do not replace a key used by existing servers.`);
  }
  return exists ? 'existing' : 'created';
}
