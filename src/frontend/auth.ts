import { currentAdminUser } from './types/adminConfig.ts';

type UserLike = {
  name?: string;
  role?: string;
  departmentName?: string;
  jobTitle?: string;
  canAccessAdminConfig?: boolean;
};

export function canAccessAdminConfig(user: UserLike | null | undefined): boolean {
  if (user?.canAccessAdminConfig) return true;
  if (user?.name === currentAdminUser.name && user?.role === currentAdminUser.role) return true;
  const department = user?.departmentName ?? '';
  const jobTitle = user?.jobTitle ?? '';
  return (
    department.includes('信息技术部') ||
    department.includes('协同办公') ||
    department.includes('技术管理中心') ||
    jobTitle.includes('管理员') ||
    jobTitle.includes('产品')
  );
}

