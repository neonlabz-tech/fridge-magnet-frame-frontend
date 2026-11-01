import { apiV1Url } from '@/lib/backendUrl';
import {
  readDemoTeams,
  saveDemoTeams,
  type DemoMember,
  type DemoSession,
} from '@/lib/demoAuth';
import { readRoles, saveRoles, type PermissionMap, type Role } from '@/lib/roles';

/**
 * Team members and roles live in the backend (MongoDB). localStorage only keeps a
 * read cache (without passwords) so the sync readers - sidebar, page access, lead
 * owners - keep working and the page still shows something when the backend is down.
 */
const TEAM_ID = 'TEAM-002';
const TEAM_NAME = 'Business Operator';
const MIGRATED_KEY = 'magnify-team-migrated';
const endpoint = (path = '') => apiV1Url(`/team${path}`);
const JSON_HEADERS = { 'Content-Type': 'application/json' };

/* ---------- cache ---------- */
export function readCachedMembers(): DemoMember[] {
  try {
    return readDemoTeams().flatMap((t) => t.members);
  } catch {
    return [];
  }
}

function writeCache(members: DemoMember[], roles: Role[]): void {
  try {
    saveDemoTeams([{ id: TEAM_ID, name: TEAM_NAME, members: members.map((m) => ({ ...m, password: '' })) }]);
    saveRoles(roles);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('magnify-team-updated'));
  } catch (e) {
    console.error('Could not cache team data.', e);
  }
}

/* ---------- helpers ---------- */
type RawMember = Partial<DemoMember> & { id?: string };
type RawRole = Partial<Role> & { id?: string };

const toMember = (r: RawMember): DemoMember => ({
  id: String(r.id ?? ''),
  name: String(r.name ?? ''),
  email: String(r.email ?? ''),
  phone: String(r.phone ?? ''),
  joinDate: String(r.joinDate ?? ''),
  role: String(r.role ?? ''),
  status: r.status === 'Inactive' ? 'Inactive' : 'Active',
  username: String(r.username ?? ''),
  password: '',
  passwordChangedAt: r.passwordChangedAt ? String(r.passwordChangedAt) : undefined,
  mustChangePassword: Boolean(r.mustChangePassword),
});

const toRole = (r: RawRole): Role => ({
  id: String(r.id ?? ''),
  name: String(r.name ?? ''),
  pages: Array.isArray(r.pages) ? r.pages.map(String) : [],
  permissions: r.permissions && typeof r.permissions === 'object' ? (r.permissions as PermissionMap) : undefined,
  widgets: Array.isArray(r.widgets) ? r.widgets.map(String) : undefined,
});

const apiError = async (res: Response, fallback: string) => {
  if (res.status >= 500) return 'Server is not reachable. Check that the backend is running.';
  try {
    const j = await res.json();
    const m = j?.message;
    return Array.isArray(m) ? m.join(', ') : String(m || fallback);
  } catch {
    return fallback;
  }
};

async function send<T>(path: string, method: string, payload: unknown, fallback: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(endpoint(path), {
      method,
      headers: JSON_HEADERS,
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  } catch {
    throw new Error('Could not reach the server. Nothing was saved.');
  }
  if (!res.ok) throw new Error(await apiError(res, fallback));
  const j = await res.json().catch(() => null);
  return (j?.data ?? j) as T;
}

async function getList<T>(path: string): Promise<T[] | null> {
  try {
    const res = await fetch(endpoint(path), { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
  } catch {
    return null;
  }
}

const sortById = (list: DemoMember[]) =>
  [...list].sort((a, b) => {
    const na = Number(a.id.replace(/\D/g, '')) || 0;
    const nb = Number(b.id.replace(/\D/g, '')) || 0;
    return na - nb;
  });

/* ---------- load + one-time migration ---------- */
export interface TeamData {
  members: DemoMember[];
  roles: Role[];
  online: boolean;
}

let inflight: Promise<TeamData> | null = null;

/**
 * Loads members and roles from the backend and refreshes the cache. The first time
 * (per browser), old localStorage roles/members are uploaded so nothing is lost.
 */
export function refreshTeam(): Promise<TeamData> {
  if (inflight) return inflight;
  inflight = (async (): Promise<TeamData> => {
    const offline = (): TeamData => ({ members: readCachedMembers(), roles: readRoles(), online: false });

    let remoteRoles = await getList<RawRole>('/roles');
    let remoteMembers = await getList<RawMember>('/members');
    if (!remoteRoles || !remoteMembers) return offline();

    let migrated = false;
    try {
      migrated = localStorage.getItem(MIGRATED_KEY) === '1';
    } catch {}

    if (!migrated) {
      try {
        const rolesRaw = localStorage.getItem('magnify-demo-roles');
        const localRoles: Role[] = rolesRaw ? (JSON.parse(rolesRaw) as Role[]) : [];
        const have = new Set(remoteRoles.map((r) => String(r.name)));
        for (const r of localRoles) {
          if (!r?.name || have.has(r.name)) continue;
          await fetch(endpoint('/roles'), {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({
              name: r.name,
              // Old local roles had full access to their pages: keep that.
              permissions: r.permissions ?? Object.fromEntries((r.pages ?? []).map((h) => [h, ['view', 'create', 'edit', 'delete']])),
            }),
          }).catch(() => null);
        }

        if (remoteMembers.length === 0) {
          for (const m of sortById(readCachedMembers())) {
            if (!m.password || m.password.length < 6) continue; // cached copies have no password
            const base = { name: m.name, email: m.email, phone: m.phone, role: m.role, password: m.password };
            let res = await fetch(endpoint('/members'), {
              method: 'POST',
              headers: JSON_HEADERS,
              body: JSON.stringify({ ...base, username: m.username }),
            }).catch(() => null);
            if (res && res.status === 400) {
              res = await fetch(endpoint('/members'), {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify(base),
              }).catch(() => null);
            }
            if (res?.ok && m.status === 'Inactive') {
              const j = await res.json().catch(() => null);
              const id = j?.data?.id;
              if (id) {
                await fetch(endpoint(`/members/${encodeURIComponent(id)}/status`), {
                  method: 'PATCH',
                  headers: JSON_HEADERS,
                  body: JSON.stringify({ status: 'Inactive' }),
                }).catch(() => null);
              }
            }
          }
        }
        remoteRoles = (await getList<RawRole>('/roles')) ?? remoteRoles;
        remoteMembers = (await getList<RawMember>('/members')) ?? remoteMembers;
        localStorage.setItem(MIGRATED_KEY, '1');
      } catch (e) {
        console.error('Could not migrate local team data.', e);
      }
    }

    const members = sortById(remoteMembers.map(toMember));
    const roles = remoteRoles.map(toRole);
    writeCache(members, roles);
    return { members, roles, online: true };
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/* ---------- members ---------- */
export interface NewMember {
  name: string;
  email: string;
  phone: string;
  role: string;
  password: string;
  username?: string;
}

export async function createMember(m: NewMember): Promise<DemoMember> {
  return toMember(await send<RawMember>('/members', 'POST', m, 'Could not create user.'));
}

export async function updateMember(
  id: string,
  patch: Partial<Pick<DemoMember, 'name' | 'email' | 'phone'>>
): Promise<DemoMember> {
  return toMember(await send<RawMember>(`/members/${encodeURIComponent(id)}`, 'PATCH', patch, 'Could not update user.'));
}

export async function setMemberStatus(id: string, status: 'Active' | 'Inactive'): Promise<void> {
  await send(`/members/${encodeURIComponent(id)}/status`, 'PATCH', { status }, 'Could not change status.');
}

/** Admin reset: returns the temporary password (shown once, never stored in readable form). */
export async function resetMemberPassword(id: string, password?: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(endpoint(`/members/${encodeURIComponent(id)}/reset-password`), {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(password ? { password } : {}),
    });
  } catch {
    throw new Error('Could not reach the server. Nothing was saved.');
  }
  if (!res.ok) throw new Error(await apiError(res, 'Could not reset password.'));
  const j = await res.json().catch(() => null);
  return String(j?.temporaryPassword ?? password ?? '');
}

export async function deleteMember(id: string): Promise<void> {
  await send(`/members/${encodeURIComponent(id)}`, 'DELETE', undefined, 'Could not delete user.');
}

/* ---------- roles ---------- */
export async function createRole(name: string, permissions: PermissionMap, widgets: string[]): Promise<Role> {
  return toRole(await send<RawRole>('/roles', 'POST', { name, permissions, widgets }, 'Could not create role.'));
}

export async function updateRole(id: string, patch: { name?: string; permissions?: PermissionMap; widgets?: string[] }): Promise<Role> {
  return toRole(await send<RawRole>(`/roles/${encodeURIComponent(id)}`, 'PATCH', patch, 'Could not update role.'));
}

export async function deleteRole(id: string): Promise<void> {
  await send(`/roles/${encodeURIComponent(id)}`, 'DELETE', undefined, 'Could not delete role.');
}

/* ---------- sign-in ---------- */
export type MemberLogin =
  | { session: DemoSession; token?: string; mustChangePassword?: boolean }
  | { error: string; denied: boolean };

/** Administrator sign-in: checked against the Admin collection in the database. */
export async function loginAdmin(email: string, password: string): Promise<MemberLogin & { token?: string }> {
  let res: Response;
  try {
    res = await fetch(apiV1Url('/auth/login'), {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { error: 'Server is not reachable. Check that the backend is running.', denied: false };
  }
  if (!res.ok) {
    return { error: await apiError(res, 'Email or password is incorrect.'), denied: res.status < 500 };
  }
  const j = await res.json().catch(() => null);
  // The same endpoint also signs in website customers: only an administrator may enter the dashboard.
  if (!j?.user || j.user.role !== 'admin') {
    return { error: 'Email or password is incorrect.', denied: true };
  }
  return {
    token: String(j.token ?? j.access_token ?? ''),
    session: {
      username: 'admin',
      email: String(j.user.email ?? email),
      name: String(j.user.fullName || 'Administrator'),
      role: 'admin',
    },
  };
}

export async function loginMember(username: string, password: string): Promise<MemberLogin> {
  let res: Response;
  try {
    res = await fetch(endpoint('/login'), {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return { error: 'Server is not reachable. Check that the backend is running.', denied: false };
  }
  if (!res.ok) {
    return { error: await apiError(res, 'Username or password is incorrect, or this account is inactive.'), denied: res.status < 500 };
  }
  const j = await res.json().catch(() => null);
  const s = j?.session;
  if (!s) return { error: 'Unexpected response from the server.', denied: false };
  return {
    token: String(j.token ?? j.access_token ?? ''),
    mustChangePassword: Boolean(j.mustChangePassword),
    session: {
      username: String(s.username),
      name: String(s.name),
      role: 'member',
      teamName: s.teamName ? String(s.teamName) : TEAM_NAME,
      allowedPages: Array.isArray(j.allowedPages) ? j.allowedPages.map(String) : undefined,
    },
  };
}


/* ---------- passwords & sign-in checks ---------- */
export const MEMBER_TOKEN_KEY = 'memberToken';

/** A team member changes their own password. Returns the fresh sign-in token (older ones are revoked). */
export async function changeMemberPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  token?: string
): Promise<string> {
  const bearer = token || (typeof window !== 'undefined' ? localStorage.getItem(MEMBER_TOKEN_KEY) : '') || '';
  let res: Response;
  try {
    res = await fetch(endpoint('/change-password'), {
      method: 'POST',
      headers: { ...JSON_HEADERS, Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  } catch {
    throw new Error('Could not reach the server. Password was not changed.');
  }
  if (res.status === 401) throw new Error('Your sign-in has expired. Please sign in again.');
  if (!res.ok) throw new Error(await apiError(res, 'Could not change password.'));
  const j = await res.json().catch(() => null);
  const next = String(j?.token ?? j?.access_token ?? '');
  if (next) localStorage.setItem(MEMBER_TOKEN_KEY, next);
  return next;
}

/** Administrator forgot password: e-mails a single-use link. Always answers the same (no account hints). */
export async function adminForgotPassword(email: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(apiV1Url('/auth/admin/forgot-password'), {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new Error('Server is not reachable. Check that the backend is running.');
  }
  if (!res.ok) throw new Error(await apiError(res, 'Could not send the reset link right now.'));
}

export async function adminResetPassword(token: string, newPassword: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(apiV1Url('/auth/admin/reset-password'), {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ token, newPassword }),
    });
  } catch {
    throw new Error('Server is not reachable. Check that the backend is running.');
  }
  if (!res.ok) throw new Error(await apiError(res, 'This reset link is invalid or has expired.'));
}

/** 'expired' only when the server says the token is no longer valid (401); otherwise stays signed in. */
export async function checkSignIn(role: 'admin' | 'member'): Promise<'ok' | 'expired' | 'unknown'> {
  try {
    const token = localStorage.getItem(role === 'admin' ? 'adminToken' : MEMBER_TOKEN_KEY);
    if (!token) return 'unknown';
    const res = await fetch(role === 'admin' ? apiV1Url('/auth/profile') : endpoint('/me'), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 401) return 'expired';
    return res.ok ? 'ok' : 'unknown';
  } catch {
    return 'unknown';
  }
}
