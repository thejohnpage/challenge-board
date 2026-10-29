# Administration MVP

The Angular Admin workspace uses Firebase Auth, Firestore listeners and three trusted
callable functions: `createOrganization`, `createLocation`, and `assignInstructor`.

## Before use

1. Deploy the repository's Firestore Security Rules.
2. Create the initial SuperAdmin document at `users/{FirebaseAuthUid}` with
   `roles: ["SuperAdmin"]` from the Firebase Console.
3. The Firebase project must have billing enabled for Cloud Functions deployment
   (Blaze plan); monitor usage and configure a budget alert.
4. From the repository root run:
   ```powershell
   cd functions
   npm install
   cd ..
   npx firebase-tools deploy --only functions,firestore:rules
   ```
5. Run `npm install` and `npm start` for Angular.

## First use

- Sign in at `/login`, then open `/admin`.
- A SuperAdmin can create an organization using a generated Firestore ID.
- Select an organization, create a location, then select the location and create a classroom.
- For instructor assignment, the instructor's email must already exist in Firebase Authentication.
  The function creates the Firestore user profile if missing and assigns a scoped Instructor
  membership plus a classroom reference.
- Never share passwords or service-account keys.

## Important limitations

- Invitation emails and creating Authentication accounts from the dashboard are not yet implemented.
- The existing Firestore rules are the authority for classroom and team operations.
- Instructor assignments create scoped organization/location discovery records. Users can select only assigned organizations and locations.
- User invitations, account creation, and role revocation are not yet implemented.
- The existing local game is not yet connected to a Firestore game session.
- Callables must be deployed before the new administration buttons will work.
- App Check enforcement should be enabled once the application and domains are registered.
