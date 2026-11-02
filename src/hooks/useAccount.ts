'use client';

import { useCallback, useEffect, useState } from 'react';

const API_BASE = '/api/v1';

export type AccountProfile = {
  id?: string;
  fullName: string;
  email: string;
  bio: string;
  avatar: string;
  twoFactorEnabled: boolean;
};

export type ProfileUpdatePayload = Partial<
  Pick<AccountProfile, 'fullName' | 'email' | 'bio' | 'avatar' | 'twoFactorEnabled'>
> & {
  currentPassword?: string;
  newPassword?: string;
};

export const EMPTY_PROFILE: AccountProfile = {
  fullName: '',
  email: '',
  bio: '',
  avatar: '',
  twoFactorEnabled: false,
};

const getToken = () => {
  if (typeof window === 'undefined') return '';
  // The dashboard login stores `adminToken`; the website login stores `token`.
  // Accept either so guarded profile calls work regardless of entry point.
  return (
    localStorage.getItem('adminToken') ||
    localStorage.getItem('token') ||
    ''
  );
};

const normalizeProfile = (raw: any): AccountProfile => {
  const user = raw?.user ?? raw ?? {};
  return {
    id: user.id,
    fullName: user.fullName || '',
    email: user.email || '',
    bio: user.bio || '',
    avatar: user.avatar || '',
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  };
};

const syncCachedUser = (profile: AccountProfile) => {
  try {
    const raw = localStorage.getItem('user');
    const cached = raw && raw !== 'undefined' ? JSON.parse(raw) : {};
    localStorage.setItem('user', JSON.stringify({ ...cached, ...profile }));
  } catch {
    // ignore cache write errors
  }
};

export const useAccount = () => {
  const [profile, setProfile] = useState<AccountProfile>(EMPTY_PROFILE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoaded(false);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      setProfile(normalizeProfile(await res.json()));
    } catch {
      // Fall back to the user cached at login so the page still shows info.
      try {
        const raw = localStorage.getItem('user');
        if (raw && raw !== 'undefined') {
          setProfile(normalizeProfile(JSON.parse(raw)));
        }
      } catch {
        // ignore
      }
      setError('Could not load account from server, showing cached info.');
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    const token = getToken();
    if (!token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      throw new Error('Your session has expired. Please log in again.');
    }
    if (!res.ok) {
      throw new Error(json?.message || `Update failed (${res.status})`);
    }

    // After a password change the server revokes the old token and sends a fresh one.
    if (json?.token) localStorage.setItem('adminToken', String(json.token));

    const next = normalizeProfile(json);
    setProfile(next);
    syncCachedUser(next);
    return next;
  }, []);

  const uploadAvatar = useCallback(async (file: File) => {
    const token = getToken();
    if (!token) {
      throw new Error('Your session has expired. Please log in again.');
    }

    const data = new FormData();
    data.append('avatar', file);

    const res = await fetch(`${API_BASE}/auth/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      throw new Error('Your session has expired. Please log in again.');
    }
    if (!res.ok) {
      throw new Error(json?.message || `Upload failed (${res.status})`);
    }

    const next = normalizeProfile(json);
    setProfile(next);
    syncCachedUser(next);
    return next;
  }, []);

  return {
    profile,
    isLoaded,
    error,
    refreshProfile: fetchProfile,
    updateProfile,
    uploadAvatar,
  };
};
