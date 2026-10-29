import { Routes } from '@angular/router';
import { authGuard, adminGuard, instructorGuard } from './auth/auth.guards';
import { LoginComponent } from './auth/login.component';
import { AccessDeniedComponent } from './auth/access-denied.component';
import { CloudWorkspaceComponent } from './cloud/cloud-workspace.component';
import { AppComponent } from './app.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'admin' },
  { path: 'login', component: LoginComponent },
  { path: 'access-denied', component: AccessDeniedComponent },
  { path: 'admin', component: CloudWorkspaceComponent, canActivate: [adminGuard] },
  { path: 'instructor', component: CloudWorkspaceComponent, canActivate: [instructorGuard] },
  { path: 'game', component: AppComponent, canActivate: [authGuard] },
  { path: 'display/:sessionId', component: AppComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'admin' }
];
