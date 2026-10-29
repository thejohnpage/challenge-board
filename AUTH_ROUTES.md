# Challenge Board Angular authentication routes

The Angular app now starts with an Angular Router shell. The existing local game is at
`/game`; opening `/` redirects to `/admin`, which requires authorization.

| Route | Guard | Current behavior |
| --- | --- | --- |
| `/login` | public | Email/password and Google popup sign-in |
| `/admin` | adminGuard | SuperAdmin or global admin role in user profile |
| `/instructor` | instructorGuard | SuperAdmin or global Instructor role in user profile |
| `/game` | authGuard | Signed-in user with a Firestore profile |
| `/display/:sessionId` | authGuard | Same local game for now; NOT yet a synchronized session |
| `/access-denied` | public | Missing profile or insufficient role |

Firebase Authentication restores sessions on refresh. A signed-in user may not see
the login screen unless they sign out. Sign-in redirects to the requested route,
or `/admin` by default.

## First SuperAdmin test

1. Confirm Firestore has `users/{firebaseAuthUid}` with `roles: ["SuperAdmin"]`.
2. Deploy the repository's `firestore.rules` before testing privileged data access.
3. Run `npm install`, `npm run build`, then `npm start`.
4. Visit `http://localhost:4200/login` and sign in.
5. Visit `http://localhost:4200/admin` and select an organization/location.
6. Sign out and try `/admin`; it should redirect to `/login?returnUrl=%2Fadmin`.

## Important limitations

- Organization/location-scoped role routing is not complete: current guards check
  global profile roles. Firestore rules remain the authority for data access.
- `/instructor` currently renders the shared Cloud Workspace, not a separate
  instructor dashboard.
- `/display/:sessionId` does not yet load or synchronize a Firestore session.
- The local game still uses browser storage and is not yet a cloud multiplayer game.
- Admin users and role assignments are provisioned through trusted administration,
  not by an Angular client write.
- Route guards are UX/navigation controls, not a substitute for Firestore Security Rules.
