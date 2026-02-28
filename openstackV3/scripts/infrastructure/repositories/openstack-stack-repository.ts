/**
 * OpenStack implementation of StackRepository.
 *
 * Uses the OpenStack CLI to perform stack operations.
 */

import type { Stack } from '../../domain/entities/stack.js';
import type { StackRepository } from '../../domain/ports/stack-repository.js';
import { openstack, openstackStream, openstackAsync } from '../openstack.js';

export const openstackStackRepository: StackRepository = {
  list(): Stack[] {
    const output = openstack(['stack', 'list', '-f', 'json'], { showOutput: false });
    const stacks = JSON.parse(output || '[]');

    return stacks.map((s: Record<string, string>) => ({
      id: s['ID'],
      name: s['Stack Name'],
      status: s['Stack Status'],
      creationTime: s['Creation Time'],
    }));
  },

  async listAsync(): Promise<Stack[]> {
    const output = await openstackAsync(['stack', 'list', '-f', 'json'], { showOutput: false, spinner: 'Loading stacks' });
    const stacks = JSON.parse(output || '[]');

    return stacks.map((s: Record<string, string>) => ({
      id: s['ID'],
      name: s['Stack Name'],
      status: s['Stack Status'],
      creationTime: s['Creation Time'],
    }));
  },

  getOutputs(stackName: string): Record<string, string> {
    const output = openstack(['stack', 'show', stackName, '-f', 'json', '-c', 'outputs'], { showOutput: false });
    const parsed = JSON.parse(output);
    const outputs: Record<string, string> = {};

    for (const item of parsed.outputs || []) {
      outputs[item.output_key] = String(item.output_value);
    }

    return outputs;
  },

  async getOutputsAsync(stackName: string): Promise<Record<string, string>> {
    const output = await openstackAsync(
      ['stack', 'show', stackName, '-f', 'json', '-c', 'outputs'],
      { showOutput: false, spinner: 'Fetching stack outputs' }
    );
    const parsed = JSON.parse(output);
    const outputs: Record<string, string> = {};

    for (const item of parsed.outputs || []) {
      outputs[item.output_key] = String(item.output_value);
    }

    return outputs;
  },

  create(stackName: string, templatePath: string, envPath: string): Promise<number> {
    return openstackStream([
      'stack', 'create',
      '-t', templatePath,
      '-e', envPath,
      stackName,
      '--wait',
    ]);
  },

  delete(stackName: string): Promise<number> {
    return openstackStream(['stack', 'delete', stackName, '--yes', '--wait']);
  },
};
