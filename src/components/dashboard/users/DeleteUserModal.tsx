'use client';

import { Trash2 } from 'lucide-react';
import type { AdminUser } from './userData';

interface DeleteUserModalProps {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: (user: AdminUser) => void;
}

export default function DeleteUserModal({
  user,
  onClose,
  onConfirm,
}: DeleteUserModalProps) {
  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
          <Trash2 size={24} />
        </div>
        <h3 className="mb-2 text-xl font-bold text-[#111827]">Delete User</h3>
        <p className="mb-6 text-sm text-[#475569]">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-[#111827]">{user.name}</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-[10px] border-2 border-[#0f3b82] bg-white text-sm font-extrabold text-[#0f3b82] hover:bg-[#eff6ff]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(user)}
            className="h-11 flex-1 rounded-[10px] bg-[#DC2626] text-sm font-extrabold text-white hover:bg-[#B91C1C]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
