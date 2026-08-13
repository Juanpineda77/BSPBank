import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Construye un JWT sin firmar; sirve porque el cliente sólo decodifica. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`;
}

const enUnaHora = () => Math.floor(Date.now() / 1000) + 3600;
const haceUnaHora = () => Math.floor(Date.now() / 1000) - 3600;

describe('AuthService', () => {
  let service: AuthService;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [AuthService, { provide: Router, useValue: router }]
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => localStorage.clear());

  it('no reconoce sesión cuando no hay token', () => {
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.getRole()).toBeNull();
    expect(service.getUserId()).toBeNull();
  });

  it('reconoce una sesión con token vigente', () => {
    service.login(fakeJwt({ id: 7, email: 'ana@bsp.mx', role: 'cliente', exp: enUnaHora() }), 'cliente');

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getUserId()).toBe(7);
    expect(service.getEmailFromToken()).toBe('ana@bsp.mx');
    expect(service.getRole()).toBe('cliente');
  });

  it('rechaza un token expirado y limpia la sesión', () => {
    service.login(fakeJwt({ id: 7, role: 'cliente', exp: haceUnaHora() }), 'cliente');

    expect(service.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('rechaza un token que no se puede decodificar', () => {
    localStorage.setItem('token', 'esto-no-es-un-jwt');
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('ignora los valores basura que dejaba el código anterior', () => {
    localStorage.setItem('token', 'undefined');
    expect(service.getToken()).toBeNull();
    expect(service.isLoggedIn()).toBeFalse();
  });

  describe('hasAnyRole', () => {
    beforeEach(() => {
      service.login(fakeJwt({ id: 1, role: 'ejecutivo', exp: enUnaHora() }), 'ejecutivo');
    });

    it('acepta un rol incluido en la lista', () => {
      expect(service.hasAnyRole(['ejecutivo', 'gerente'])).toBeTrue();
    });

    it('rechaza un rol ajeno', () => {
      expect(service.hasAnyRole(['cliente'])).toBeFalse();
    });

    it('compara sin distinguir mayúsculas', () => {
      expect(service.hasAnyRole(['EJECUTIVO'])).toBeTrue();
    });
  });

  describe('homeRouteForRole', () => {
    it('manda a cada rol a su panel', () => {
      const casos: Array<[string, string]> = [
        ['cliente', '/cliente'],
        ['ejecutivo', '/ejecutive'],
        ['gerente', '/gerente']
      ];

      for (const [rol, ruta] of casos) {
        service.login(fakeJwt({ id: 1, role: rol, exp: enUnaHora() }), rol);
        expect(service.homeRouteForRole()).toBe(ruta);
      }
    });

    it('sin sesión manda al login', () => {
      expect(service.homeRouteForRole()).toBe('/login');
    });
  });

  it('logout borra la sesión y navega al login', () => {
    service.login(fakeJwt({ id: 1, role: 'cliente', exp: enUnaHora() }), 'cliente');

    service.logout();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('role')).toBeNull();
    expect(service.isLoggedIn()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
