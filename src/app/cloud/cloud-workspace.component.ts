import { Component, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CloudWorkspaceService } from './cloud-workspace.service';
import { cloudEnabled } from './cloud-config';

@Component({
  selector: 'app-cloud-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <main class="cloud-workspace">
    <h2>Cloud Classroom Workspace</h2>
    <p>Manage classroom and team records through Firebase Authentication and Firestore.</p>
    <p *ngIf="!configured" class="validation">
      Firebase is not configured. Add the Firebase Web App configuration in
      <code>src/app/cloud/cloud-config.ts</code>. The existing local quiz is still available.
    </p>
    <ng-container *ngIf="configured">
      <form *ngIf="!cloud.user()" (ngSubmit)="login()" class="cloud-panel">
        <h3>Instructor / Administrator sign in</h3>
        <label>Email <input type="email" name="email" [(ngModel)]="email" required autocomplete="username"></label>
        <label for="cloud-password">Password</label>
        <div class="password-field">
          <input id="cloud-password" [type]="showPassword() ? 'text' : 'password'" name="password"
            [(ngModel)]="password" required autocomplete="current-password">
          <button type="button" class="password-toggle" (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            [attr.aria-pressed]="showPassword()" [title]="showPassword() ? 'Hide password' : 'Show password'">
            <svg *ngIf="!showPassword()" xmlns="http://www.w3.org/2000/svg" width="21" height="21"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <svg *ngIf="showPassword()" xmlns="http://www.w3.org/2000/svg" width="21" height="21"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m3 3 18 18"/>
              <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3.1 3.9"/>
              <path d="M6.4 6.4C3.5 8.3 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.1-.8"/>
              <path d="M10 10a3 3 0 0 0 4 4"/>
            </svg>
          </button>
        </div>
        <button type="submit" [disabled]="busy()">Sign in</button>
      </form>
      <div *ngIf="cloud.user()" class="cloud-panel">
        <div class="cloud-heading">
          <span>Signed in as <strong>{{cloud.user()?.email}}</strong></span>
          <button (click)="logout()">Sign out</button>
        </div>
        <ng-container *ngIf="cloud.profile() as profile; else pendingProfile">
          <p><strong>{{profile.first_name}} {{profile.last_name}}</strong> · Roles: {{profile.roles.join(', ') || 'None assigned'}}</p>
          <p *ngIf="cloud.isSuperAdmin">Platform SuperAdmin access is enabled.</p>
          <h3>Organizations</h3>
          <section *ngIf="cloud.isSuperAdmin" class="cloud-create">
            <label>Organization name <input [(ngModel)]="organizationName" placeholder="MultiMedia Communications"></label>
            <label>Code <input [(ngModel)]="organizationCode" placeholder="MMCI"></label>
            <button type="button" (click)="createOrganization()" [disabled]="busy()">Create organization</button>
          </section>
          <p *ngIf="!cloud.organizations().length">No organizations are available. Create the first organization in the Firebase Console.</p>
          <div class="cloud-classes">
            <button *ngFor="let org of cloud.organizations()"
              [class.gold]="cloud.selectedOrganizationId()===org.id"
              (click)="chooseOrganization(org.id)">{{org.name}}</button>
          </div>
          <ng-container *ngIf="cloud.selectedOrganizationId()">
            <p>Organization role: {{cloud.isOrgAdmin ? 'Administrator' : (cloud.organizationMembership()?.roles?.join(', ') || 'No scoped role')}}</p>
            <h3>Locations</h3>
            <section *ngIf="cloud.isOrgAdmin" class="cloud-create">
              <label>Location name <input [(ngModel)]="locationName" placeholder="Fidelity Westlake"></label>
              <label>City <input [(ngModel)]="locationCity" placeholder="Westlake"></label>
              <label>State <input [(ngModel)]="locationState" placeholder="TX"></label>
              <button type="button" (click)="createLocation()" [disabled]="busy()">Create location</button>
            </section>
            <p *ngIf="!cloud.locations().length">No locations are available. Create the first location in Firestore.</p>
            <div class="cloud-classes">
              <button *ngFor="let loc of cloud.locations()"
                [class.gold]="cloud.selectedLocationId()===loc.id"
                (click)="chooseLocation(loc.id)">{{loc.name}}</button>
            </div>
          </ng-container>
          <ng-container *ngIf="cloud.selectedLocationId()">
            <p>Location role: {{cloud.isLocationAdmin ? 'Administrator' : (cloud.locationMembership()?.roles?.join(', ') || 'No scoped role')}}</p>
            <section *ngIf="cloud.isLocationAdmin" class="cloud-create">
              <h3>Create classroom</h3>
              <input [(ngModel)]="classroomName" placeholder="Classroom name" aria-label="New classroom name">
              <button (click)="createClassroom()" [disabled]="busy()">Create classroom</button>
            </section>
            <h3>Classrooms</h3>
            <p *ngIf="!cloud.classrooms().length">No classrooms available yet.</p>
            <div class="cloud-classes">
              <button *ngFor="let room of cloud.classrooms()"
                [class.gold]="selectedClassroom()===room.id"
                (click)="selectClassroom(room.id)">{{room.name}}</button>
            </div>
            <ng-container *ngIf="selectedClassroom() as roomId">
              <p>Assigned instructors: {{instructorCount(roomId)}}</p>
              <h3>Instructor assignment</h3>
              <section *ngIf="cloud.isLocationAdmin" class="cloud-create">
                <label>Instructor email <input type="email" [(ngModel)]="instructorEmail" placeholder="instructor@example.com"></label>
                <button type="button" (click)="assignInstructor(roomId)" [disabled]="busy()">Assign instructor to classroom</button>
              </section>
              <h3>Teams</h3>
              <section *ngIf="cloud.canManageClassroom(roomId)" class="cloud-create">
                <input [(ngModel)]="teamName" placeholder="New team name" aria-label="New team name">
                <button (click)="createTeam()" [disabled]="busy()">Add team</button>
              </section>
              <div class="cloud-team" *ngFor="let team of cloud.teams()">
                <strong>{{team.name}}</strong>
                <span>Score: {{team.score}}</span>
                <button *ngIf="cloud.canManageClassroom(roomId)"
                  (click)="renameTeam(team.id,team.name)">Rename</button>
              </div>
              <p *ngIf="!cloud.teams().length">No teams in this classroom yet.</p>
            </ng-container>
          </ng-container>
        </ng-container>
        <ng-template #pendingProfile>
          <p>No profile found at <code>users/{{cloud.user()?.uid}}</code>.
          Create a user document with the Firebase Authentication UID as its document ID
          and a <code>roles</code> array.</p>
        </ng-template>
      </div>
      <p class="validation" *ngIf="cloud.error()">{{cloud.error()}}</p>
      <p class="validation" *ngIf="message()">{{message()}}</p>
    </ng-container>
  </main>`,
  styles: [`
    .cloud-workspace{max-width:1050px;margin:20px auto;padding:20px}
    .cloud-panel{background:#102a62;border-radius:12px;padding:20px;display:grid;gap:14px;margin:20px 0}
    .cloud-panel label{display:grid;gap:6px}
    .cloud-panel input{max-width:450px}
    .password-field{display:flex;align-items:stretch;width:min(450px,100%)}
    .password-field input{flex:1;min-width:0;max-width:none;border-radius:6px 0 0 6px}
    .password-toggle{display:flex;align-items:center;justify-content:center;min-width:48px;border-radius:0 6px 6px 0;background:#204aa8;border:1px solid #6c8de5;color:#fff;cursor:pointer}
    .password-toggle:focus-visible{outline:3px solid #ffda5d;outline-offset:2px}
    .cloud-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
    .cloud-create{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:16px 0}
    .cloud-classes{display:flex;flex-wrap:wrap;gap:8px}
    .cloud-team{background:#071a42;border-radius:8px;padding:12px;margin:8px 0;display:flex;align-items:center;gap:16px}
    .cloud-team span{margin-left:auto}
  `]
})
export class CloudWorkspaceComponent implements OnDestroy {
  readonly cloud = inject(CloudWorkspaceService);
  readonly configured = cloudEnabled();
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly message = signal('');
  readonly selectedClassroom = signal<string | null>(null);
  email = '';
  password = '';
  classroomName = '';
  teamName = '';
  organizationName = '';
  organizationCode = '';
  locationName = '';
  locationCity = '';
  locationState = '';
  instructorEmail = '';


  async chooseOrganization(id: string) {
    this.selectedClassroom.set(null);
    await this.cloud.selectOrganization(id);
  }
  async chooseLocation(id: string) {
    this.selectedClassroom.set(null);
    await this.cloud.selectLocation(id);
  }
  async login() {
    this.busy.set(true);
    try { await this.cloud.login(this.email, this.password); this.password=''; }
    catch { this.message.set('Unable to sign in.'); }
    finally { this.busy.set(false); }
  }
  async logout() { await this.cloud.logout(); this.selectedClassroom.set(null); }
  selectClassroom(id: string) {
    this.selectedClassroom.set(id);
    this.cloud.watchTeams(id);
  }
  private async perform(action: () => Promise<unknown>, success: string) {
    this.busy.set(true);
    this.message.set('');
    try { await action(); this.message.set(success); }
    catch (error) { this.message.set(error instanceof Error ? error.message : 'Operation failed.'); }
    finally { this.busy.set(false); }
  }
  async createOrganization() {
    if (!this.organizationName.trim() || !this.organizationCode.trim()) {
      this.message.set('Enter an organization name and code.'); return;
    }
    await this.perform(async () => {
      await this.cloud.createOrganization(this.organizationName, this.organizationCode);
      this.organizationName = ''; this.organizationCode = '';
    }, 'Organization created.');
  }
  async createLocation() {
    if (!this.locationName.trim()) { this.message.set('Enter a location name.'); return; }
    await this.perform(async () => {
      await this.cloud.createLocation(this.locationName, this.locationCity, this.locationState);
      this.locationName = ''; this.locationCity = ''; this.locationState = '';
    }, 'Location created.');
  }
  instructorCount(classroomId: string): number {
    return this.cloud.classrooms().find(room => room.id === classroomId)?.instructorIds?.length ?? 0;
  }
  async assignInstructor(classroomId: string) {
    if (!this.instructorEmail.trim()) { this.message.set('Enter an instructor email.'); return; }
    await this.perform(async () => {
      await this.cloud.assignInstructor(classroomId, this.instructorEmail);
      this.instructorEmail = '';
    }, 'Instructor assigned to classroom.');
  }
  async createClassroom() {
    if (!this.cloud.isLocationAdmin || !this.classroomName.trim()) return;
    this.busy.set(true);
    try { await this.cloud.createClassroom(this.classroomName);this.classroomName=''; }
    catch { this.message.set('Classroom creation failed. Check permissions.'); }
    finally { this.busy.set(false); }
  }
  async createTeam() {
    const room=this.selectedClassroom();
    if (!room || !this.teamName.trim()) return;
    this.busy.set(true);
    try { await this.cloud.createTeam(room,this.teamName);this.teamName=''; }
    catch { this.message.set('Team creation failed. Check permissions.'); }
    finally { this.busy.set(false); }
  }
  async renameTeam(id: string, oldName: string) {
    const name=prompt('Team name',oldName)?.trim();
    const room=this.selectedClassroom();
    if (!name || !room || name===oldName) return;
    try { await this.cloud.renameTeam(room,id,name); }
    catch { this.message.set('Unable to rename team.'); }
  }
  ngOnDestroy() { this.cloud.disconnect(); }
}
