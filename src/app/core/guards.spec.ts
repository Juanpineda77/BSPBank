import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter
} from '@angular/router';
import { authGuard, roleGuard, guestOnlyGuard } from './guards';
import { AuthService } from './auth.service';

/** Ejecuta un guard funcional dentro del contexto de inyección de Angular. */
function runGuard(
  guard: typeof authGuard,
  { url = '/', roles }: { url?: string; roles?: string[] } = {}
) {
  const route = { data: roles ? { roles } : {} } as unknown as ActivatedRouteSnapshot;
  const state = { url } as RouterStateSnapshot;
  return TestBed.runInInjectionContext(() => guard(route, state));
}

describe('guards de ruta', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'isLoggedIn',
      'hasAnyRole',
      'homeRouteForRole'
    ]);

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }]
    });
    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('deja pasar con sesión iniciada', () => {
      auth.isLoggedIn.and.returnValue(true);
      expect(runGuard(authGuard)).toBeTrue();
    });

    it('redirige al login y conserva el returnUrl', () => {
      auth.isLoggedIn.and.returnValue(false);

      const result = runGuard(authGuard, { url: '/cliente' });

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree))
        .toBe('/login?returnUrl=%2Fcliente');
    });
  });

  describe('roleGuard', () => {
    it('deja pasar cuando el rol coincide', () => {
      auth.isLoggedIn.and.returnValue(true);
      auth.hasAnyRole.and.returnValue(true);

      expect(runGuard(roleGuard, { roles: ['cliente'] })).toBeTrue();
    });

    it('manda a /forbidden cuando el rol no coincide', () => {
      auth.isLoggedIn.and.returnValue(true);
      auth.hasAnyRole.and.returnValue(false);

      const result = runGuard(roleGuard, { url: '/gerente', roles: ['gerente'] });

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
    });

    it('manda al login si no hay sesión, aunque la ruta pida un rol', () => {
      auth.isLoggedIn.and.returnValue(false);

      const result = runGuard(roleGuard, { url: '/gerente', roles: ['gerente'] });

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree))
        .toBe('/login?returnUrl=%2Fgerente');
      // Sin sesión no tiene sentido preguntar por el rol.
      expect(auth.hasAnyRole).not.toHaveBeenCalled();
    });

    it('deja pasar si la ruta no declara roles', () => {
      auth.isLoggedIn.and.returnValue(true);
      expect(runGuard(roleGuard)).toBeTrue();
    });
  });

  describe('guestOnlyGuard', () => {
    it('deja entrar al login sin sesión', () => {
      auth.isLoggedIn.and.returnValue(false);
      expect(runGuard(guestOnlyGuard, { url: '/login' })).toBeTrue();
    });

    it('con sesión activa manda al panel del rol', () => {
      auth.isLoggedIn.and.returnValue(true);
      auth.homeRouteForRole.and.returnValue('/gerente');

      const result = runGuard(guestOnlyGuard, { url: '/login' });

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/gerente');
    });
  });
});
