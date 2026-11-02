'use client';

import { createPortal } from 'react-dom';
import { KeyRound } from 'lucide-react';
import { ModalShell } from '@/components/dashboard/shared/UiKit';
import MemberPasswordCard from '@/components/dashboard/account/MemberPasswordCard';

/** Popup for team members to change their own password from the sidebar. */
export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <ModalShell
      open={open}
      onClose={onClose}
      icon={<KeyRound size={18} />}
      title="Change password"
      subtitle="Enter your current password and choose a new one."
      maxWidth="max-w-md"
    >
      <div className="px-5 pb-5 sm:px-6">
        <MemberPasswordCard embedded onDone={onClose} />
      </div>
    </ModalShell>,
    document.body,
  );
}
