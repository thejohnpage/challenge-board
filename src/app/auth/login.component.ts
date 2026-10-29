import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CloudWorkspaceService } from '../cloud/cloud-workspace.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="login-page">
      <form class="login-card" (ngSubmit)="login()">
        <h2>Sign in to Challenge Board</h2>
        <p>Use your registered Firebase account.</p>
        <label for="login-email">Email</label>
        <input id="login-email" name="email" type="email" autocomplete="username" [(ngModel)]="email" required>
        <label for="login-password">Password</label>
        <div class="password-field">
          <input id="login-password" name="password" [type]="showPassword() ? 'text' : 'password'"
            autocomplete="current-password" [(ngModel)]="password" required>
          <button type="button" (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            [attr.aria-pressed]="showPassword()" [title]="showPassword() ? 'Hide password' : 'Show password'">
            <svg *ngIf="!showPassword()" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <svg *ngIf="showPassword()" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 3 21 21"/><path d="M10 5c.7-.1 1.3-.1 2-.1 6.5 0 10 7 10 7a15 15 0 0 1-3 4"/>
              <path d="M6 6C3.5 8 2 12 2 12s3.5 7 10 7c1.5 0 2.8-.3 4-.8"/>
            </svg>
          </button>
        </div>
        <p role="alert" class="login-error" *ngIf="error()">{{error()}}</p>
        <button type="submit" [disabled]="busy()">Sign in</button>
        <button type="button" (click)="googleLogin()" [disabled]="busy()">Continue with Google</button>
      </form>
    </main>`,
  styles: [`
    .login-page{min-height:65vh;display:grid;place-items:center;padding:24px}
    .login-card{display:grid;gap:12px;width:min(430px,100%);padding:28px;background:#102a62;border:1px solid #6c8de5;border-radius:14px}
    .login-card h2{margin:0}.login-card p{margin:0 0 8px}
    .login-card input{width:100%;min-width:0}
    .password-field{display:flex}.password-field input{flex:1;border-radius:6px 0 0 6px}
    .password-field button{display:grid;place-items:center;min-width:48px;border-radius:0 6px 6px 0}
    .login-error{color:#ffc1c1}
  `]
})
export class LoginComponent {
  readonly cloud = inject(CloudWorkspaceService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly showPassword = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  email = '';
  password = '';

  private destination(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    return requested?.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/login')
      ? requested : '/admin';
  }
  private async finishLogin() {
    await this.cloud.whenReady();
    // Authentication callbacks may still be loading the user profile.
    if (!this.cloud.profile()) {
      // Let the profile loader finish on the next navigation if needed.
      await this.router.navigateByUrl('/access-denied');
      return;
    }
    await this.router.navigateByUrl(this.destination());
  }
  async login() {
    this.busy.set(true); this.error.set('');
    try {
      await this.cloud.login(this.email, this.password);
      this.password = '';
      await this.finishLogin();
    } catch { this.error.set('Sign-in failed. Check your credentials.'); }
    finally { this.busy.set(false); }
  }
  async googleLogin() {
    this.busy.set(true); this.error.set('');
    try { await this.cloud.loginWithGoogle(); await this.finishLogin(); }
    catch { this.error.set('Google sign-in was cancelled or failed.'); }
    finally { this.busy.set(false); }
  }
}
