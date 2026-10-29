# Challenge Board — Firebase authentication and authorization

Firebase project: `mmci-challenge-board`. The Angular app can run locally with `npm start`
while Firebase Authentication and Firestore are hosted in Firebase.

## Identity and roles

Firebase Authentication assigns the immutable UID. The Firestore profile document
**must** use that UID as its document ID: `users/{authUid}`.

Initial trusted SuperAdmin profile (create manually in Firebase Console):
```json
{
  "email": "johnpage@multimediacommunications.net",
  "first_name": "John",
  "last_name": "Page",
  "roles": ["SuperAdmin"]
}
```
Document ID for this initial account: `gJj1SlGiFjUzYh98sZaDZvX5Mdo2`.
If the existing user profile has an auto-generated ID, **copy** it to a document
with the correct UID, verify the new record, then remove the obsolete copy.
Do not recreate the Firebase Authentication user.

`SuperAdmin` is a **global** role, not tied to any organization or location.
Additional roles are assigned through **scoped membership documents**:
- `organizations/{orgId}/memberships/{uid}` with `roles: ["OrgAdmin"]`
- `organizations/{orgId}/locations/{locationId}/memberships/{uid}`
  with `roles: ["LocationAdmin"]` or `roles: ["Instructor"]`,
  plus `classroomIds: ["classroomDocumentId"]` for instructors.

Organizations, locations and classrooms use **generated Firestore document IDs**.
Their editable `name` fields are not identifiers. Create the initial organization
and location records manually in Firebase Console:
- `organizations/{autoId}`: `name: "MultiMedia Communications"`, `code: "MMCI"`
- `organizations/{autoId}/locations/{autoId}`: `name: "Fidelity Westlake"`,
  `city: "Westlake"`, `state: "TX"`

## Deploy rules

```powershell
npm install
npm run build
npx firebase-tools use mmci-challenge-board
npx firebase-tools deploy --only firestore:rules
```

Then sign out and back in from **Cloud Workspace** at `http://localhost:4200`.
The SuperAdmin should be able to select the organization and location and
create classrooms and teams. Role assignments and parent organization/location
records are provisioned through trusted administration, not the browser.

## Security and current limitations

- Client writes to user profiles, role assignments, organization/location records,
  round state and scores are denied.
- This is a **bootstrap SuperAdmin workflow**. Organization/location admins require
  a scoped organization/location selection mechanism; the current organization
  directory is designed for the SuperAdmin.
- A future Cloud Function using the Firebase Admin SDK will provision users and
  memberships and enforce role changes with audit logging.
- The browser-only game is not yet synchronized with Firestore.
- No service-account private keys or passwords belong in this repository.
