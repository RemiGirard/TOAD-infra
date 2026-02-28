/**
 * Use case: List all deployed stacks.
 *
 * Pure business logic - delegates to repository for data access.
 */

import type { Stack } from '../entities/stack.js';
import type { StackRepository } from '../ports/stack-repository.js';

export function listStacks(repo: StackRepository): Stack[] {
  return repo.list();
}
