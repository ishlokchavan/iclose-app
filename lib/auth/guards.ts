import type { UserRole } from '../../types/database';

export const MANAGER_ROLES: UserRole[] = ['manager', 'admin'];
export const LEARNER_ROLES: UserRole[] = ['learner', 'educator'];

export function isManager(role: UserRole | null): boolean {
  if (!role) return false;
  return MANAGER_ROLES.includes(role);
}

export function isLearner(role: UserRole | null): boolean {
  if (!role) return false;
  return LEARNER_ROLES.includes(role);
}

export function isAdmin(role: UserRole | null): boolean {
  return role === 'admin';
}

export function getHomeRoute(role: UserRole | null): string {
  if (!role) return '/(auth)/sign-in';
  if (isManager(role)) return '/(manager)';
  return '/(learner)/topics';
}
