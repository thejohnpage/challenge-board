export type WorkspaceRole = 'platformAdmin' | 'organizationAdmin' | 'locationAdmin' | 'instructor' | 'member';
export interface Membership {
  uid: string;
  organizationId: string;
  locationId: string;
  classroomIds: string[];
  role: WorkspaceRole;
}
export interface Classroom {
  id: string;
  name: string;
  instructorIds: string[];
  createdAt?: unknown;
}
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
