import React from 'react';
import { Badge } from '../ui/Badge';
import type { UserRole } from '../../types/database';

const roleLabels: Record<UserRole, string> = {
  learner: 'Learner',
  educator: 'Educator',
  manager: 'Manager',
  admin: 'Admin',
};

interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return <Badge label={roleLabels[role]} variant={role} />;
}
