export type WorkspaceRole = 'SuperAdmin' | 'OrgAdmin' | 'LocationAdmin' | 'Instructor' | 'TeamLead' | 'TeamMember';
export interface UserProfile {
  email: string;
  first_name: string;
  last_name: string;
  roles: WorkspaceRole[];
}
export interface Organization { id: string; name: string; code?: string }
export interface Location { id: string; name: string; city?: string; state?: string }
export interface ScopedMembership { roles: WorkspaceRole[]; classroomIds?: string[] }
export interface Classroom { id: string; name: string; instructorIds: string[]; createdAt?: unknown }
export interface CloudTeam {
  id: string;
  name: string;
  classroomId: string;
  score: number;
  leadUid?: string | null;
  memberUids: string[];
}
export interface GameSession {
  id: string;
  classroomId: string;
  questionBankId: string;
  status: 'lobby' | 'clueOpen' | 'buzzLocked' | 'answerRevealed' | 'scored' | 'finished';
  activeClueId: string | null;
  usedClueIds: string[];
  winningTeamId: string | null;
}
