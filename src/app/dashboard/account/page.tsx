'use client';

import { useEffect, useState } from 'react';
import AccountHeader from '@/components/dashboard/account/AccountHeader';
import ProfileInformationCard from '@/components/dashboard/account/ProfileInformationCard';
import MemberPasswordCard from '@/components/dashboard/account/MemberPasswordCard';
import SecurityCard, {
  type PasswordFields,
} from '@/components/dashboard/account/SecurityCard';
import AccountActions from '@/components/dashboard/account/AccountActions';
import { readSession } from '@/lib/crm';
import { passwordIssue } from '@/lib/password';
import { useAccount, type AccountProfile } from '@/hooks/useAccount';
import { useToastStore } from '@/store/toastStore';

const EMPTY_PASSWORDS: PasswordFields = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function AccountPage() {
  const { profile, isLoaded, error, updateProfile, uploadAvatar } = useAccount();
  const { addToast } = useToastStore();

  const [form, setForm] = useState<AccountProfile>(profile);
  const [passwords, setPasswords] = useState<PasswordFields>(EMPTY_PASSWORDS);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Team members have no admin profile and cannot change their password here.
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    setIsMember(readSession()?.role === 'member');
  }, []);

  useEffect(() => {
    if (isLoaded && !hydrated) {
      setForm(profile);
      setHydrated(true);
    }
  }, [isLoaded, hydrated, profile]);

  useEffect(() => {
    if (error && !isMember) addToast(error, 'info');
  }, [error, isMember, addToast]);

  const updateForm = (patch: Partial<AccountProfile>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const updatePasswords = (patch: Partial<PasswordFields>) =>
    setPasswords((prev) => ({ ...prev, ...patch }));

  const handleUploadAvatar = async (file: File) => {
    const next = await uploadAvatar(file);
    updateForm({ avatar: next.avatar });
    addToast('Profile photo updated.', 'success');
  };

  const handleCancel = () => {
    setForm(profile);
    setPasswords(EMPTY_PASSWORDS);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      addToast('Full name is required.', 'error');
      return;
    }
    if (!form.email.trim()) {
      addToast('Email address is required.', 'error');
      return;
    }

    const changingPassword = passwords.newPassword.length > 0;
    if (changingPassword) {
      if (!passwords.currentPassword) {
        addToast('Enter your current password to set a new one.', 'error');
        return;
      }
      const issue = passwordIssue(passwords.newPassword);
      if (issue) {
        addToast(issue, 'error');
        return;
      }
      if (passwords.newPassword !== passwords.confirmPassword) {
        addToast('New password and confirmation do not match.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      await updateProfile({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        bio: form.bio,
        avatar: form.avatar,
        twoFactorEnabled: form.twoFactorEnabled,
        ...(changingPassword
          ? {
              currentPassword: passwords.currentPassword,
              newPassword: passwords.newPassword,
            }
          : {}),
      });

      setPasswords(EMPTY_PASSWORDS);
      addToast('Account settings saved.', 'success');
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : 'Failed to save account settings.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-white px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <AccountHeader />

      {isMember ? (
        <div className="mx-auto mt-4 flex w-full max-w-md flex-col items-center">
          <MemberPasswordCard />
          <p className="mt-3 text-center text-xs text-[#64748B]">
            If you forget your password, ask your administrator to reset it.
          </p>
        </div>
      ) : (
      <>
      <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-start">
        <ProfileInformationCard
          profile={form}
          loading={!isLoaded}
          onChange={updateForm}
          onUploadAvatar={handleUploadAvatar}
          onError={(message) => addToast(message, 'error')}
        />

        <SecurityCard
          passwords={passwords}
          twoFactorEnabled={form.twoFactorEnabled}
          onPasswordChange={updatePasswords}
          onToggleTwoFactor={(value) => updateForm({ twoFactorEnabled: value })}
        />
      </div>

      <AccountActions
        saving={saving}
        loading={!isLoaded}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      </>
      )}
    </div>
  );
}