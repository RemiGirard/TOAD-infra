/**
 * Port: Stack Repository
 *
 * Abstraction for stack persistence operations.
 * Infrastructure layer provides the concrete implementation.
 */

import type { Stack } from '../entities/stack.js';

export interface StackRepository {
  list(): Stack[];
  listAsync(): Promise<Stack[]>;
  getOutputs(stackName: string): Record<string, string>;
  getOutputsAsync(stackName: string): Promise<Record<string, string>>;
  create(stackName: string, templatePath: string, envPath: string): Promise<number>;
  delete(stackName: string): Promise<number>;
}
