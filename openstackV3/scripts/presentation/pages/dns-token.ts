/** Store an Infomaniak DNS token locally without echoing it. */

import { chmodSync, writeFileSync } from 'node:fs';
import { askSecret, banner, success } from '../../infrastructure/cli.js';
import { INFOMANIAK_DNS_TOKEN_PATH } from '../../infrastructure/paths.js';

export async function run(): Promise<void> {
  banner('TOAD DNS Credential');
  const token = (await askSecret('Infomaniak dns:read + dns:write token')).trim();
  if (token.length < 20) throw new Error('The token is empty or unexpectedly short. Nothing was written.');
  writeFileSync(INFOMANIAK_DNS_TOKEN_PATH, `${token}\n`, { mode: 0o600 });
  chmodSync(INFOMANIAK_DNS_TOKEN_PATH, 0o600);
  success(`Saved the token to ${INFOMANIAK_DNS_TOKEN_PATH} with mode 0600.`);
}
