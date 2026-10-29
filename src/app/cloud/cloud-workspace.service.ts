import { Injectable, signal } from '@angular/core';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, addDoc, updateDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { cloudClient } from './cloud-config';
import type { Classroom, CloudTeam, Location, Organization, ScopedMembership, UserProfile } from './cloud-models';

@Injectable({ providedIn: 'root' })
export class CloudWorkspaceService {
  readonly client = cloudClient();
  readonly user = signal<User | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly organizationMembership = signal<ScopedMembership | null>(null);
  readonly locationMembership = signal<ScopedMembership | null>(null);
  readonly organizations = signal<Organization[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly classrooms = signal<Classroom[]>([]);
  readonly teams = signal<CloudTeam[]>([]);
  readonly selectedOrganizationId = signal<string | null>(null);
  readonly selectedLocationId = signal<string | null>(null);
  readonly error = signal('');
  private listeners: Unsubscribe[] = [];
  private authGeneration = 0;

  constructor() {
    if (!this.client) return;
    onAuthStateChanged(this.client.auth, async user => {
      const generation = ++this.authGeneration;
      this.disconnect();
      this.user.set(user);
      this.profile.set(null);
      this.error.set('');
      if (!user) return;
      try {
        const snapshot = await getDoc(doc(this.client!.db, 'users', user.uid));
        if (generation !== this.authGeneration) return;
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<UserProfile>;
          this.profile.set({
            email: data.email || user.email || '',
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            roles: Array.isArray(data.roles) ? data.roles : []
          });
          this.watchOrganizations();
        }
      } catch {
        if (generation === this.authGeneration) this.error.set('Unable to load your user profile. Check Firestore rules.');
      }
    });
  }

  get isSuperAdmin() { return this.profile()?.roles.includes('SuperAdmin') ?? false; }
  get isOrgAdmin() { return this.isSuperAdmin || (this.organizationMembership()?.roles.includes('OrgAdmin') ?? false); }
  get isLocationAdmin() {
    return this.isOrgAdmin || (this.locationMembership()?.roles.includes('LocationAdmin') ?? false);
  }
  canManageClassroom(classroomId: string) {
    return this.isLocationAdmin ||
      ((this.locationMembership()?.roles.includes('Instructor') ?? false) &&
        (this.locationMembership()?.classroomIds || []).includes(classroomId));
  }

  async login(email: string, password: string) {
    if (!this.client) throw Error('Firebase is not configured.');
    this.error.set('');
    await signInWithEmailAndPassword(this.client.auth, email, password);
  }
  async logout() { if (this.client) await signOut(this.client.auth); }

  private listen<T extends { id: string }>(path: string, target: { set(value: T[]): void }) {
    if (!this.client) return;
    const unsubscribe = onSnapshot(collection(this.client.db, path),
      snap => target.set(snap.docs.map(d => ({ ...d.data(), id: d.id } as T))),
      () => this.error.set('Permission denied or unable to read ' + path));
    this.listeners.push(unsubscribe);
  }

  watchOrganizations() {
    this.listen<Organization>('organizations', this.organizations);
  }

  async selectOrganization(orgId: string) {
    if (!this.client || !this.user()) return;
    this.disconnectSelections();
    this.selectedOrganizationId.set(orgId);
    try {
      const membership = await getDoc(doc(this.client.db, 'organizations', orgId, 'memberships', this.user()!.uid));
      if (this.selectedOrganizationId() !== orgId) return;
      this.organizationMembership.set(membership.exists() ? membership.data() as ScopedMembership : null);
      this.listen<Location>(`organizations/${orgId}/locations`, this.locations);
    } catch { this.error.set('Unable to access this organization.'); }
  }

  async selectLocation(locationId: string) {
    if (!this.client || !this.user()) return;
    const orgId = this.selectedOrganizationId();
    if (!orgId) return;
    this.clearLocation();
    this.selectedLocationId.set(locationId);
    try {
      const membership = await getDoc(doc(this.client.db, 'organizations', orgId, 'locations', locationId, 'memberships', this.user()!.uid));
      if (this.selectedOrganizationId() !== orgId || this.selectedLocationId() !== locationId) return;
      this.locationMembership.set(membership.exists() ? membership.data() as ScopedMembership : null);
      this.listen<Classroom>(`organizations/${orgId}/locations/${locationId}/classrooms`, this.classrooms);
    } catch { this.error.set('Unable to access this location.'); }
  }

  watchTeams(classroomId: string) {
    const orgId = this.selectedOrganizationId(), locId = this.selectedLocationId();
    if (!orgId || !locId) return;
    this.teams.set([]);
    this.listen<CloudTeam>(`organizations/${orgId}/locations/${locId}/classrooms/${classroomId}/teams`, this.teams);
  }

  async createClassroom(name: string) {
    if (!this.client || !this.isLocationAdmin) throw Error('Not authorized.');
    const orgId = this.selectedOrganizationId(), locId = this.selectedLocationId();
    if (!orgId || !locId || !name.trim()) throw Error('Choose a location and enter a classroom name.');
    return addDoc(collection(this.client.db, 'organizations', orgId, 'locations', locId, 'classrooms'),
      { name: name.trim(), instructorIds: [], createdAt: serverTimestamp() });
  }

  async createTeam(classroomId: string, name: string) {
    if (!this.client || !this.canManageClassroom(classroomId)) throw Error('Not authorized.');
    const orgId = this.selectedOrganizationId(), locId = this.selectedLocationId();
    if (!orgId || !locId || !name.trim()) throw Error('Choose a classroom and enter a team name.');
    return addDoc(collection(this.client.db, 'organizations', orgId, 'locations', locId, 'classrooms', classroomId, 'teams'),
      { name: name.trim(), classroomId, score: 0, leadUid: null, memberUids: [] });
  }

  async renameTeam(classroomId: string, teamId: string, name: string) {
    if (!this.client || !this.canManageClassroom(classroomId)) throw Error('Not authorized.');
    const orgId = this.selectedOrganizationId(), locId = this.selectedLocationId();
    if (!orgId || !locId || !name.trim()) throw Error('Choose a classroom and enter a team name.');
    await updateDoc(doc(this.client.db, 'organizations', orgId, 'locations', locId, 'classrooms', classroomId, 'teams', teamId),
      { name: name.trim() });
  }

  private clearLocation() {
    this.listeners.splice(2).forEach(stop => stop());
    this.selectedLocationId.set(null);
    this.locationMembership.set(null);
    this.classrooms.set([]);
    this.teams.set([]);
  }
  private disconnectSelections() {
    this.listeners.splice(1).forEach(stop => stop());
    this.selectedOrganizationId.set(null);
    this.organizationMembership.set(null);
    this.locations.set([]);
    this.clearLocation();
  }
  disconnect() {
    this.listeners.splice(0).forEach(stop => stop());
    this.selectedOrganizationId.set(null);
    this.selectedLocationId.set(null);
    this.organizationMembership.set(null);
    this.locationMembership.set(null);
    this.organizations.set([]);
    this.locations.set([]);
    this.classrooms.set([]);
    this.teams.set([]);
  }
}
