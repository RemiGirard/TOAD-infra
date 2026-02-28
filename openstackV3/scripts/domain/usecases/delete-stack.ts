/**
 * Use case: Delete a deployed stack.
 *
 * Business rules:
 * - Stack name must be provided
 * - Returns success/failure result
 */

import type { StackRepository } from '../ports/stack-repository.js';

export interface DeleteStackResult {
  success: boolean;
  error?: string;
}

export async function deleteStack(
  repo: StackRepository,
  stackName: string
): Promise<DeleteStackResult> {
  if (!stackName) {
    return { success: false, error: 'Stack name is required' };
  }

  const exitCode = await repo.delete(stackName);

  if (exitCode !== 0) {
    return { success: false, error: 'Stack deletion failed' };
  }

  return { success: true };
}
