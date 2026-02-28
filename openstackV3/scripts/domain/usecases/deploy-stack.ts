/**
 * Use case: Deploy a new infrastructure stack.
 *
 * Business rules:
 * - Validates level is within range
 * - Creates stack with specified template and environment
 */

import type { StackRepository } from '../ports/stack-repository.js';
import { isValidLevel, getLevel } from '../entities/level.js';

export interface DeployStackInput {
  level: number;
  stackName: string;
  envFile: string;
}

export interface DeployStackResult {
  success: boolean;
  error?: string;
}

export async function deployStack(
  repo: StackRepository,
  input: DeployStackInput
): Promise<DeployStackResult> {
  // Business rule: validate level
  if (!isValidLevel(input.level)) {
    return { success: false, error: `Invalid level: ${input.level}` };
  }

  const levelInfo = getLevel(input.level)!;
  const templatePath = `heat/${levelInfo.template}`;

  const exitCode = await repo.create(input.stackName, templatePath, input.envFile);

  if (exitCode !== 0) {
    return { success: false, error: 'Stack creation failed' };
  }

  return { success: true };
}
