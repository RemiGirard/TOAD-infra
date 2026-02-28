/**
 * Use case: Get stack outputs.
 *
 * Retrieves the outputs of a deployed Heat stack (IPs, etc.).
 * Pure business logic - delegates to repository for data access.
 */

import type { StackRepository } from '../ports/stack-repository.js';

export function getStackOutputs(
  repo: StackRepository,
  stackName: string
): Record<string, string> {
  return repo.getOutputs(stackName);
}
