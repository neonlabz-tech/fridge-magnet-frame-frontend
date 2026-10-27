export const USER_ROLES = ['Super Admin', 'Admin', 'Manager', 'Staff'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type UserStatus = 'Active' | 'Inactive';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export type AdminUserInput = Omit<AdminUser, 'id' | 'createdAt'>;

export const ROLE_STYLES: Record<UserRole, string> = {
  'Super Admin': 'bg-[#EDE9FE] text-[#6D28D9]',
  Admin: 'bg-[#DBEAFE] text-[#1D4ED8]',
  Manager: 'bg-[#FEF3C7] text-[#B45309]',
  Staff: 'bg-[#F1F5F9] text-[#475569]',
};

export const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
