import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  id?: number | string;
  email?: string;
  role?: string;
  exp?: number;
}

/**
 * Sesión del usuario: token JWT, rol y datos derivados del token.
 *
 * El token se guarda en localStorage; el id y el email se leen del propio
 * JWT en vez de duplicarlos como entradas sueltas.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  private static readonly TOKEN_KEY = 'token';
  private static readonly ROLE_KEY = 'role';

  login(token: string, role?: string): void {
    localStorage.setItem(AuthService.TOKEN_KEY, token);
    if (role) localStorage.setItem(AuthService.ROLE_KEY, role.toLowerCase());
  }

  logout(): void {
    localStorage.removeItem(AuthService.TOKEN_KEY);
    localStorage.removeItem(AuthService.ROLE_KEY);
    localStorage.removeItem('id');
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    const token = localStorage.getItem(AuthService.TOKEN_KEY);
    return token && token !== 'undefined' && token !== 'null' ? token : null;
  }

  /** Hay token y no está expirado. */
  isLoggedIn(): boolean {
    const payload = this.decodeToken();
    if (!payload) return false;
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      // Token vencido: limpiamos para no dejar una sesión fantasma.
      localStorage.removeItem(AuthService.TOKEN_KEY);
      localStorage.removeItem(AuthService.ROLE_KEY);
      return false;
    }
    return true;
  }

  getRole(): string | null {
    return this.decodeToken()?.role?.toLowerCase()
      ?? localStorage.getItem(AuthService.ROLE_KEY);
  }

  hasAnyRole(roles: string[]): boolean {
    const role = this.getRole();
    return !!role && roles.map(r => r.toLowerCase()).includes(role);
  }

  getEmailFromToken(): string | null {
    return this.decodeToken()?.email ?? null;
  }

  getUserId(): number | null {
    const id = this.decodeToken()?.id;
    return id != null ? Number(id) : null;
  }

  /** Ruta inicial que corresponde al rol de la sesión actual. */
  homeRouteForRole(): string {
    switch (this.getRole()) {
      case 'cliente': return '/cliente';
      case 'ejecutivo': return '/ejecutive';
      case 'gerente': return '/gerente';
      default: return '/login';
    }
  }

  private decodeToken(): JwtPayload | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }
}
