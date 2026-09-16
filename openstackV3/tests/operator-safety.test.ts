import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ipv4HostCidr } from '../scripts/infrastructure/operator-access.js';
import { runProgram } from '../scripts/infrastructure/shell.js';

describe('operator safety helpers', () => {
  it('normalizes only IPv4 host CIDRs', () => {
    assert.equal(ipv4HostCidr(' 192.0.2.10\n'), '192.0.2.10/32');
    for (const address of ['example.com', '2001:db8::1', '192.0.2.999', '192.0.2.1/24']) {
      assert.throws(() => ipv4HostCidr(address));
    }
  });

  it('passes hostile-looking values as argv without a shell', () => {
    const value = '$(touch /tmp/toad-must-not-exist);`id`;*';
    const output = runProgram(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', value], {
      showCommand: false,
      showOutput: false,
    });
    assert.equal(output, value);
  });
});
