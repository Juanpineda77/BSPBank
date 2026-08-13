import { inject } from '@angular/core';
import { Router, UrlTree, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/** Exige sesión iniciada. */
export const authGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Exige sesión iniciada y uno de los roles declarados en `data.roles`. */
export const roleGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  const roles = (route.data?.['roles'] as string[] | undefined) ?? [];
  return roles.length === 0 || auth.hasAnyRole(roles)
    ? true
    : router.createUrlTree(['/forbidden']);
};

/** Impide volver al login con sesión activa: manda al panel del rol. */
export const guestOnlyGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn()
    ? router.createUrlTree([auth.homeRouteForRole()])
    : true;
};
