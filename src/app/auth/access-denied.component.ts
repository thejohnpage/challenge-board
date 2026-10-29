import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [RouterLink],
  template: `<main class="access-denied"><h2>Access not available</h2>
    <p>Your account is signed in, but it has no authorized access to this workspace.
    An administrator must provision your user profile and assign the appropriate role.</p>
    <a routerLink="/login">Return to sign in</a></main>`,
  styles: [`.access-denied{max-width:650px;margin:60px auto;padding:24px}`]
})
export class AccessDeniedComponent {}
