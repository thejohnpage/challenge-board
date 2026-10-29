# Challenge Board — Firebase foundation

The existing browser-only game remains available without Firebase. This foundation adds
Firebase Auth, Firestore models, classroom/team service operations, security rules, and Hosting configuration.

## Initial setup
1. Create a Firebase project and register a **Web** app.
2. Enable **Authentication > Email/Password** and create the initial administrator account.
3. Create a **Cloud Firestore** database (production mode). Choose a region deliberately.
4. Paste the web configuration into `src/app/cloud/cloud-config.ts`.
5. Run `npm install`, `npm run build`, and `npx firebase-tools login`.
6. Run `npx firebase-tools use --add` and select your Firebase project.
7. Deploy rules with `npx firebase-tools deploy --only firestore:rules`.
8. Deploy the Angular site with `npx firebase-tools deploy --only hosting`.

## Bootstrap (trusted administrator only)
The browser cannot grant roles. Create the initial `users/{uid}` document from the Firebase
Console or an Admin SDK script using:
```json
{
  "uid": "FIREBASE_AUTH_UID",
  "organizationId": "fidelity",
  "locationId": "westlake-tx",
  "classroomIds": [],
  "role": "locationAdmin"
}
```
Create the parent documents `organizations/fidelity` and
`organizations/fidelity/locations/westlake-tx` in the console.
Do not allow untrusted users to write role assignments.

## Next milestone
Build a dedicated instructor/admin workspace UI, organization onboarding,
secure account invitations, classroom assignment, team sessions, and server-authoritative
scoring and buzzing. The current local game is **not** yet synchronized with Firestore.
No passwords or Firebase service-account credentials belong in this repository.

## Security boundaries
Firestore rules deny client writes to user roles, round state, and team scores.
A trusted server action is needed to administer accounts, award points, and accept buzzes.
The web app Firebase configuration is not a secret; rules and server authorization are essential.
