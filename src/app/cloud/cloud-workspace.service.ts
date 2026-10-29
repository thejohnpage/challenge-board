import { Injectable, signal } from '@angular/core';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection, doc, getDoc, onSnapshot, addDoc, setDoc, updateDoc,
  serverTimestamp, type Unsubscribe
} from 'firebase/firestore';
import { cloudClient } from './cloud-config';
import type { Classroom, CloudTeam, Membership } from './cloud-models';

@Injectable({ providedIn: 'root' })
export class CloudWorkspaceService {
  readonly client = cloudClient();
  readonly user = signal<User | null>(null);
  readonly error = signal('');
  readonly classrooms = signal<Classroom[]>([]);
  readonly teams = signal<CloudTeam[]>([]);
  readonly membership = signal<Membership | null>(null);
  private stopClassrooms?: Unsubscribe;
  private stopTeams?: Unsubscribe;

  constructor() {
    if (this.client) {
      onAuthStateChanged(this.client.auth, async user => {
        this.user.set(user);
        this.disconnect();
        this.membership.set(null);
        if (!user) return;
        try {
          const profile = await getDoc(doc(this.client!.db, 'users', user.uid));
          if (profile.exists()) this.membership.set(profile.data() as Membership);
        } catch { this.error.set('Unable to load your access permissions.'); }
      });
    }
  }

  async login(email: string, password: string) {
    if (!this.client) throw Error('Firebase is not configured.');
    this.error.set('');
    try { await signInWithEmailAndPassword(this.client.auth, email, password); }
    catch (e) { this.error.set('Sign-in failed. Check your credentials.'); throw e; }
  }
  async logout() { if (this.client) await signOut(this.client.auth); }

  /** Only scoped, authorized classroom and team documents are subscribed to. */
  watchClassrooms(orgId: string, locationId: string) {
    if (!this.client) return;
    this.disconnect();
    const path = this.locationPath(orgId, locationId);
    this.stopClassrooms = onSnapshot(collection(this.client.db, path, 'classrooms'),
      snap => this.classrooms.set(snap.docs.map(d => ({ ...d.data(), id: d.id } as Classroom))),
      () => this.error.set('Unable to read classrooms; check your permissions.'));
  }
  watchTeams(orgId: string, locationId: string, classroomId: string) {
    if (!this.client) return;
    this.stopTeams?.();
    this.stopTeams = onSnapshot(collection(this.client.db, this.locationPath(orgId, locationId), 'classrooms', classroomId, 'teams'),
      snap => this.teams.set(snap.docs.map(d => ({ ...d.data(), id: d.id } as CloudTeam))),
      () => this.error.set('Unable to read teams; check your permissions.'));
  }
  async createClassroom(orgId: string, locationId: string, name: string) {
    if (!this.client) throw Error('Firebase is not configured.');
    return addDoc(collection(this.client.db, this.locationPath(orgId, locationId), 'classrooms'),
      { name: name.trim(), instructorIds: [], createdAt: serverTimestamp() });
  }
  async createTeam(orgId: string, locationId: string, classroomId: string, name: string) {
    if (!this.client) throw Error('Firebase is not configured.');
    return addDoc(collection(this.client.db, this.locationPath(orgId, locationId), 'classrooms', classroomId, 'teams'),
      { name: name.trim(), classroomId, score: 0, leadUid: null, memberUids: [] });
  }
  async renameTeam(orgId: string, locationId: string, classroomId: string, teamId: string, name: string) {
    if (!this.client) throw Error('Firebase is not configured.');
    await updateDoc(doc(this.client.db, this.locationPath(orgId, locationId), 'classrooms', classroomId, 'teams', teamId),
      { name: name.trim() });
  }
  /** Scoring is intentionally NOT writable by teams. Future server action will own it. */
  private locationPath(orgId: string, locationId: string) {
    return `organizations/${orgId}/locations/${locationId}`;
  }
  disconnect() {
    this.stopClassrooms?.(); this.stopClassrooms = undefined;
    this.stopTeams?.(); this.stopTeams = undefined;
    this.classrooms.set([]); this.teams.set([]);
  }
}
