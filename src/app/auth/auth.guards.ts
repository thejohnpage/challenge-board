import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CloudWorkspaceService } from '../cloud/cloud-workspace.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const cloud = inject(CloudWorkspaceService);
  const router = inject(Router);
  await cloud.whenReady();
  if (!cloud.user()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (!cloud.profile()) return router.createUrlTree(['/access-denied']);
  return true;
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  const cloud = inject(CloudWorkspaceService);
  const router = inject(Router);
  await cloud.whenReady();
  if (!cloud.user()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (!cloud.profile()) return router.createUrlTree(['/access-denied']);
  if (cloud.isSuperAdmin || (cloud.profile()?.organizationIds?.length ?? 0) > 0) return true;
  // Scoped memberships are resolved after organization/location selection.
  // Do not grant administrative routes based on an unverified global role.
  return router.createUrlTree(['/access-denied']);
};

export const instructorGuard: CanActivateFn = async (_route, state) => {
  const cloud = inject(CloudWorkspaceService);
  const router = inject(Router);
  await cloud.whenReady();
  if (!cloud.user()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (!cloud.profile()) return router.createUrlTree(['/access-denied']);
  if (cloud.isSuperAdmin || (cloud.profile()?.organizationIds?.length ?? 0) > 0) return true;
  return router.createUrlTree(['/access-denied']);
};
