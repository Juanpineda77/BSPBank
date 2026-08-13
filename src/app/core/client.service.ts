import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { API_URL } from './api.config';

export interface ClienteActual {
  nombre: string;
  nivel: string;
  saldo: number;
  iniciales: string;
  email?: string;
  /** 1 cuando la cuenta tiene login biométrico activo. */
  webauthn_enabled?: number;
}

/**
 * Datos del cliente autenticado.
 *
 * Antes cada pantalla repetía la misma llamada a `/cliente/actual` y su
 * propia copia de `getIniciales()`; ahora vive en un solo lugar.
 * El token lo adjunta el interceptor, no hace falta pasarlo a mano.
 */
@Injectable({ providedIn: 'root' })
export class ClientService {
  private http = inject(HttpClient);
  private cache?: Observable<ClienteActual>;

  getCurrent(): Observable<ClienteActual> {
    if (!this.cache) {
      this.cache = this.http.get<any>(`${API_URL}/cliente/actual`).pipe(
        map(data => {
          const cliente = data?.cliente ?? data;
          return {
            ...cliente,
            saldo: data?.saldo ?? cliente?.saldo,
            iniciales: ClientService.iniciales(cliente?.nombre)
          } as ClienteActual;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.cache;
  }

  /** Fuerza una recarga (p. ej. después de una transferencia). */
  refresh(): Observable<ClienteActual> {
    this.cache = undefined;
    return this.getCurrent();
  }

  static iniciales(nombre?: string): string {
    return nombre
      ? nombre.trim().split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2)
      : '';
  }
}
