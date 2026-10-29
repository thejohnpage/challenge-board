import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { CloudWorkspaceService } from './cloud/cloud-workspace.service';
import { APP_VERSION } from './generated/app-version';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  template: `
    <header class="shell-header">
      <a routerLink="/admin" class="brand">CHALLENGE <span>BOARD</span></a>
      <nav *ngIf="cloud.user()">
        <a routerLink="/admin" *ngIf="cloud.isSuperAdmin || cloud.isOrgAdmin || cloud.isLocationAdmin">Admin</a>
        <a routerLink="/instructor">Instructor</a>
        <a routerLink="/game">Game</a>
        <button type="button" (click)="logout()">Sign out</button>
      </nav>
    </header>
    <router-outlet></router-outlet>
    <footer class="app-footer" role="contentinfo">
      <span>© {{year}} MultiMedia Communications. All rights reserved.</span>
      <span>Challenge Board v{{version}}</span>
    </footer>
  `,
  styles: [`
    .shell-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 22px;background:#061638;flex-wrap:wrap}
    .brand{color:#fff;font-size:23px;font-weight:800;text-decoration:none}
    .brand span{color:#ffda5d}
    nav{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    nav a{color:#dbe7ff;text-decoration:none}
  `]
})
export class AppShellComponent {
  readonly cloud = inject(CloudWorkspaceService);
  private readonly router = inject(Router);
  readonly year = new Date().getFullYear();
  readonly version = APP_VERSION;
  async logout() { await this.cloud.logout(); await this.router.navigateByUrl('/login'); }
}
