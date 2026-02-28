/**
 * Stack entity - represents a Heat stack deployment.
 *
 * A stack is a collection of OpenStack resources (VMs, networks, etc.)
 * created from a Heat template.
 */

export interface Stack {
  id: string;
  name: string;
  status: StackStatus;
  creationTime: string;
}

export type StackStatus =
  | 'CREATE_COMPLETE'
  | 'CREATE_IN_PROGRESS'
  | 'CREATE_FAILED'
  | 'DELETE_IN_PROGRESS'
  | 'DELETE_COMPLETE'
  | 'DELETE_FAILED'
  | 'UPDATE_COMPLETE'
  | 'UPDATE_IN_PROGRESS'
  | 'UPDATE_FAILED';

export function isStackReady(stack: Stack): boolean {
  return stack.status === 'CREATE_COMPLETE' || stack.status === 'UPDATE_COMPLETE';
}

export function isStackFailed(stack: Stack): boolean {
  return stack.status.includes('FAILED');
}

export function isStackInProgress(stack: Stack): boolean {
  return stack.status.includes('IN_PROGRESS');
}
