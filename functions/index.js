import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp();
const db = getFirestore();
const auth = getAuth();
const region = 'us-central1';
const settings = { region, maxInstances: 5, enforceAppCheck: false };

function text(value, field, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new HttpsError('invalid-argument', field + ' is required and must be shorter than ' + max + ' characters.');
  return value.trim();
}
function requiredAuth(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return request.auth.uid;
}
async function profile(uid) {
  const snapshot = await db.doc('users/' + uid).get();
  return snapshot.exists ? snapshot.data() : null;
}
async function isSuper(uid) {
  const p = await profile(uid);
  return Array.isArray(p?.roles) && p.roles.includes('SuperAdmin');
}
async function hasRole(path, role) {
  const snap = await db.doc(path).get();
  return snap.exists && Array.isArray(snap.data()?.roles) && snap.data().roles.includes(role);
}
async function orgAdmin(uid, orgId) {
  return (await isSuper(uid)) || await hasRole(`organizations/${orgId}/memberships/${uid}`, 'OrgAdmin');
}
async function locationAdmin(uid, orgId, locId) {
  return await orgAdmin(uid, orgId) ||
    await hasRole(`organizations/${orgId}/locations/${locId}/memberships/${uid}`, 'LocationAdmin');
}
async function assertExists(path, label) {
  if (!(await db.doc(path).get()).exists) throw new HttpsError('not-found', label + ' not found.');
}
function requirePermission(ok) {
  if (!ok) throw new HttpsError('permission-denied', 'You do not have permission for this operation.');
}
function orgPath(id) { return 'organizations/' + id; }
function locationPath(orgId, locationId) { return `${orgPath(orgId)}/locations/${locationId}`; }

export const createOrganization = onCall(settings, async request => {
  const uid = requiredAuth(request);
  requirePermission(await isSuper(uid));
  const name = text(request.data?.name, 'Organization name');
  const code = text(request.data?.code, 'Organization code', 30);
  const ref = db.collection('organizations').doc();
  await ref.create({ name, code, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
  return { id: ref.id };
});

export const createLocation = onCall(settings, async request => {
  const uid = requiredAuth(request);
  const organizationId = text(request.data?.organizationId, 'Organization ID');
  requirePermission(await orgAdmin(uid, organizationId));
  await assertExists(orgPath(organizationId), 'Organization');
  const name = text(request.data?.name, 'Location name');
  const city = typeof request.data?.city === 'string' ? request.data.city.trim().slice(0,100) : '';
  const state = typeof request.data?.state === 'string' ? request.data.state.trim().slice(0,50) : '';
  const ref = db.collection(locationPath(organizationId, '_placeholder')).parent.collection('locations').doc();
  // Use the parent organization reference, not a location document.
  const actualRef = db.doc(orgPath(organizationId)).collection('locations').doc();
  await actualRef.create({ name, city, state, createdAt: FieldValue.serverTimestamp(), createdBy: uid });
  return { id: actualRef.id };
});

export const assignInstructor = onCall(settings, async request => {
  const uid = requiredAuth(request);
  const organizationId = text(request.data?.organizationId, 'Organization ID');
  const locationId = text(request.data?.locationId, 'Location ID');
  const classroomId = text(request.data?.classroomId, 'Classroom ID');
  const email = text(request.data?.email, 'Instructor email', 254).toLowerCase();
  requirePermission(await locationAdmin(uid, organizationId, locationId));
  const classroomPath = `${locationPath(organizationId, locationId)}/classrooms/${classroomId}`;
  await assertExists(classroomPath, 'Classroom');
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch (err) {
    if (err?.code === 'auth/user-not-found')
      throw new HttpsError('failed-precondition', 'Instructor must have a Firebase Authentication account first.');
    throw err;
  }
  const userRef = db.doc('users/' + user.uid);
  const membershipRef = db.doc(`${locationPath(organizationId, locationId)}/memberships/${user.uid}`);
  const classroomRef = db.doc(classroomPath);
  await db.runTransaction(async transaction => {
    const [memberSnap, profileSnap, classroomSnap] = await Promise.all([
      transaction.get(membershipRef), transaction.get(userRef), transaction.get(classroomRef)
    ]);
    if (!classroomSnap.exists) throw new HttpsError('not-found', 'Classroom not found.');
    const existing = memberSnap.exists ? memberSnap.data() : {};
    const roles = Array.isArray(existing.roles) ? existing.roles : [];
    const classroomIds = Array.isArray(existing.classroomIds) ? existing.classroomIds : [];
    transaction.set(membershipRef, {
      ...existing,
      roles: [...new Set([...roles, 'Instructor'])],
      classroomIds: [...new Set([...classroomIds, classroomId])],
      updatedAt: FieldValue.serverTimestamp()
    });
    if (!profileSnap.exists) transaction.set(userRef, {
      email: user.email || email, first_name: '', last_name: '', roles: []
    });
    transaction.update(classroomRef, { instructorIds: FieldValue.arrayUnion(user.uid) });
  });
  return { uid: user.uid, email: user.email || email, classroomId };
});
