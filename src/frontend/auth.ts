import { currentAdminUser } from './types/adminConfig.ts';

type UserLike = {
  name?: string;
  role?: string;
};

export function canAccessAdminConfig(user: UserLike | null | undefined): boolean {
  return user?.name === currentAdminUser.name && user?.role === currentAdminUser.role;
}

