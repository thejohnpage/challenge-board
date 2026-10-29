import { Injectable, signal } from '@angular/core';
import { User, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, addDoc, updateDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { cloudClient } from './cloud-config';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
  readonly ready = signal(false);
  private readonly readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private listeners: Unsubscribe[] = [];
  private organizationsListening = false;
  private authGeneration = 0;

  constructor() {
    this.readyPromise = new Promise<void>(resolve => { this.resolveReady = resolve; });
    if (!this.client) { this.finishInitialization(); return; }
    onAuthStateChanged(this.client.auth, async user => {
      const generation = ++this.authGeneration;
      this.disconnect();
      this.user.set(user);
      this.profile.set(null);
      this.error.set('');
      if (!user) { this.finishInitialization(); return; }
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
      } finally {
        if (generation === this.authGeneration) this.finishInitialization();
      }
    });
  }

  private finishInitialization() { if (!this.ready()) { this.ready.set(true); this.resolveReady(); } }
  whenReady(): Promise<void> { return this.readyPromise; }
  async loginWithGoogle() {
    if (!this.client) throw Error('Firebase is not configured.');
    this.error.set('');
    const credential = await signInWithPopup(this.client.auth, new GoogleAuthProvider());
    await this.loadSignedInProfile(credential.user);
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

  private async loadSignedInProfile(user: User) {
    if (!this.client) return;
    const snapshot = await getDoc(doc(this.client.db, 'users', user.uid));
    if (!snapshot.exists()) { this.profile.set(null); return; }
    const data = snapshot.data() as Partial<UserProfile>;
    this.profile.set({
      email: data.email || user.email || '',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      roles: Array.isArray(data.roles) ? data.roles : []
    });
    this.watchOrganizations();
  }
  async login(email: string, password: string) {
    if (!this.client) throw Error('Firebase is not configured.');
    this.error.set('');
    const credential = await signInWithEmailAndPassword(this.client.auth, email, password);
    await this.loadSignedInProfile(credential.user);
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
    if (this.organizationsListening) return;
    this.organizationsListening = true;
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
    // Keep one active team listener when switching classrooms.
    if (this.listeners.length > 3) this.listeners.splice(3).forEach(stop => stop());
    this.teams.set([]);
    this.listen<CloudTeam>(`organizations/${orgId}/locations/${locId}/classrooms/${classroomId}/teams`, this.teams);
  }

  private async adminCall<T>(name: string, payload: Record<string, unknown>): Promise<T> {
    if (!this.client || !this.user()) throw Error('Sign in to continue.');
    const callable = httpsCallable<Record<string, unknown>, T>(
      getFunctions(this.client.app, 'us-central1'), name
    );
    const result = await callable(payload);
    return result.data;
  }

  async createOrganization(name: string, code: string) {
    if (!this.isSuperAdmin) throw Error('Only a SuperAdmin can create organizations.');
    return this.adminCall<{ id: string }>('createOrganization', { name, code });
  }

  async createLocation(name: string, city: string, state: string) {
    const organizationId = this.selectedOrganizationId();
    if (!organizationId || !this.isOrgAdmin) throw Error('Select an organization with administrator access.');
    return this.adminCall<{ id: string }>('createLocation', { organizationId, name, city, state });
  }

  async assignInstructor(classroomId: string, email: string) {
    const organizationId = this.selectedOrganizationId();
    const locationId = this.selectedLocationId();
    if (!organizationId || !locationId || !this.isLocationAdmin)
      throw Error('Select a location with administrator access.');
    return this.adminCall<{ uid: string; email: string; classroomId: string }>(
      'assignInstructor', { organizationId, locationId, classroomId, email }
    );
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
    this.organizationsListening = false;
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
