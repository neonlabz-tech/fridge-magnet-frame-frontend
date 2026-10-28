'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { ROLE_STYLES, getInitials, type AdminUser } from './userData';

interface UserTableProps {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function UserTable({
  users,
  onEdit,
  onDelete,
  onToggleStatus,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="px-5 py-16 text-center text-sm font-medium text-[#64748B]">
        No users found.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr className="bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
            <th className="px-5 py-3">User</th>
            <th className="px-5 py-3">Phone</th>
            <th className="px-5 py-3">Role</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Joined</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const active = user.status === 'Active';

            return (
              <tr
                key={user.id}
                className="border-t border-[#E2E8F0] text-sm text-[#111827] hover:bg-[#F8FAFC]"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-[#002B73] text-[13px] font-bold text-white">
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{user.name}</p>
                      <p className="truncate text-[13px] text-[#64748B]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-[#475569]">
                  {user.phone || '—'}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${ROLE_STYLES[user.role]}`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => onToggleStatus(user)}
                    title={active ? 'Deactivate user' : 'Activate user'}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold transition ${
                      active
                        ? 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0]'
                        : 'bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FECACA]'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${active ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}
                    />
                    {user.status}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-[#475569]">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      aria-label={`Edit ${user.name}`}
                      className="flex size-9 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#2563EB] hover:bg-[#EFF6FF]"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(user)}
                      aria-label={`Delete ${user.name}`}
                      className="flex size-9 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#DC2626] hover:bg-[#FEF2F2]"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
