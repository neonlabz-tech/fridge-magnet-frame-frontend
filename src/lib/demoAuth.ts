export const DEMO_TEAMS_KEY = 'magnify-demo-teams';
export const DEMO_SESSION_KEY = 'magnify-demo-session';

export interface DemoMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  role: string;
  status: 'Active' | 'Inactive';
  username: string;
  password: string;
}

export interface DemoTeam {
  id: string;
  name: string;
  members: DemoMember[];
}

export interface DemoSession {
  username: string;
  name: string;
  role: 'admin' | 'member';
  /** Admin sessions: the admin's email address. */
  email?: string;
  teamName?: string;
  /** Pages sent by the backend at sign-in (used until the team cache is loaded). */
  allowedPages?: string[];
}

export const INITIAL_DEMO_TEAMS: DemoTeam[] = [
  { id: 'TEAM-001', name: 'Sales Team', members: [] },
  { id: 'TEAM-002', name: 'Business Operator', members: [] },
];

export function readDemoTeams(): DemoTeam[] {
  const saved = localStorage.getItem(DEMO_TEAMS_KEY);
  if (!saved) return INITIAL_DEMO_TEAMS;

  try {
    const teams: unknown = JSON.parse(saved);
    if (!Array.isArray(teams)) {
      throw new Error('Saved demo teams are not a list.');
    }
    return teams as DemoTeam[];
  } catch (error) {
    console.error('Could not read demo teams from local storage.', error);
    throw new Error('Saved team data could not be loaded. Clear demo data and try again.');
  }
}

export function saveDemoTeams(teams: DemoTeam[]): void {
  localStorage.setItem(DEMO_TEAMS_KEY, JSON.stringify(teams));
}

export function authenticateDemoUser(
  username: string,
  password: string,
): DemoSession | null {
  const team = readDemoTeams().find((entry) =>
    entry.members.some(
      (member) =>
        member.username.toLowerCase() === username.toLowerCase() &&
        member.password === password &&
        member.status === 'Active',
    ),
  );
  const member = team?.members.find(
    (entry) =>
      entry.username.toLowerCase() === username.toLowerCase() &&
      entry.password === password &&
      entry.status === 'Active',
  );

  return member && team
    ? {
        username: member.username,
        name: member.name,
        role: 'member',
        teamName: team.name,
      }
    : null;
}
