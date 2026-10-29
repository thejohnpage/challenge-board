import { Component, OnDestroy, effect, signal, inject } from '@angular/core';
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
        <label>Password <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password"></label>
        <button type="submit" [disabled]="busy()">Sign in</button>
      </form>
      <div *ngIf="cloud.user()" class="cloud-panel">
        <div class="cloud-heading">
          <span>Signed in as <strong>{{cloud.user()?.email}}</strong></span>
          <button (click)="logout()">Sign out</button>
        </div>
        <ng-container *ngIf="cloud.membership() as member; else pendingProfile">
          <p><strong>Role:</strong> {{member.role}} · <strong>Organization:</strong> {{member.organizationId}} · <strong>Location:</strong> {{member.locationId}}</p>
          <section *ngIf="canAdmin(member.role)" class="cloud-create">
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
            <h3>Teams</h3>
            <section *ngIf="canManageRoom(member.role,member.classroomIds,roomId)" class="cloud-create">
              <input [(ngModel)]="teamName" placeholder="New team name" aria-label="New team name">
              <button (click)="createTeam()" [disabled]="busy()">Add team</button>
            </section>
            <div class="cloud-team" *ngFor="let team of cloud.teams()">
              <strong>{{team.name}}</strong>
              <span>Score: {{team.score}}</span>
              <button *ngIf="canManageRoom(member.role,member.classroomIds,roomId)"
                (click)="renameTeam(team.id,team.name)">Rename</button>
            </div>
            <p *ngIf="!cloud.teams().length">No teams in this classroom yet.</p>
          </ng-container>
        </ng-container>
        <ng-template #pendingProfile>
          <p>No role assignment found. A trusted administrator must provision
          <code>users/{{cloud.user()?.uid}}</code> before this account can manage classrooms.</p>
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
  readonly message = signal('');
  readonly selectedClassroom = signal<string | null>(null);
  email = '';
  password = '';
  classroomName = '';
  teamName = '';

  constructor() {
    effect(() => {
      const member = this.cloud.membership();
      if (member) this.cloud.watchClassrooms(member.organizationId, member.locationId);
    });
  }
  canAdmin(role: string) {
    return ['platformAdmin','organizationAdmin','locationAdmin'].includes(role);
  }
  canManageRoom(role: string, assigned: string[], id: string) {
    return this.canAdmin(role) || (role === 'instructor' && assigned.includes(id));
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
    const member = this.cloud.membership();
    if (member) this.cloud.watchTeams(member.organizationId, member.locationId, id);
  }
  async createClassroom() {
    const member=this.cloud.membership();
    if (!member || !this.classroomName.trim()) return;
    this.busy.set(true);
    try { await this.cloud.createClassroom(member.organizationId,member.locationId,this.classroomName);this.classroomName=''; }
    catch { this.message.set('Classroom creation failed. Check permissions.'); }
    finally { this.busy.set(false); }
  }
  async createTeam() {
    const member=this.cloud.membership(), room=this.selectedClassroom();
    if (!member || !room || !this.teamName.trim()) return;
    this.busy.set(true);
    try { await this.cloud.createTeam(member.organizationId,member.locationId,room,this.teamName);this.teamName=''; }
    catch { this.message.set('Team creation failed. Check permissions.'); }
    finally { this.busy.set(false); }
  }
  async renameTeam(id: string, oldName: string) {
    const name=prompt('Team name',oldName)?.trim();
    const member=this.cloud.membership(),room=this.selectedClassroom();
    if (!name || !member || !room || name===oldName) return;
    try { await this.cloud.renameTeam(member.organizationId,member.locationId,room,id,name); }
    catch { this.message.set('Unable to rename team.'); }
  }
  ngOnDestroy() { this.cloud.disconnect(); }
}
