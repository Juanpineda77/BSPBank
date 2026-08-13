import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { CreditOffer } from '../../models/credit-offer.model';

export interface EligibilityResponse {
  creditoActivo: boolean;
  ingresoMensual: number;
  maxMontoPermitido: number;
}

/**
 * Crédito del cliente autenticado.
 *
 * El backend identifica al cliente por el JWT, así que ningún método
 * recibe (ni debe recibir) un id de usuario por parámetro.
 * El token lo adjunta el interceptor.
 */
@Injectable({ providedIn: 'root' })
export class CreditService {
  private http = inject(HttpClient);

  /** Catálogo de ofertas disponibles. */
  getCreditOffers(): CreditOffer[] {
    return [
      { id: 1, titulo: 'Crédito Personal', monto: 50000, interes: 22 },
      { id: 2, titulo: 'Crédito Nómina', monto: 100000, interes: 18 },
      { id: 3, titulo: 'Crédito Premium', monto: 250000, interes: 14 }
    ];
  }

  /** ¿Puede solicitar crédito y hasta cuánto? */
  checkEligibility(): Observable<EligibilityResponse> {
    return this.http.get<EligibilityResponse>(`${API_URL}/credit/check`);
  }

  requestCredit(data: { ingreso: number; monto: number; plazo: number }): Observable<any> {
    return this.http.post(`${API_URL}/credit/request`, data);
  }

  getActiveCredit(): Observable<any> {
    return this.http.get(`${API_URL}/credit/active`);
  }

  payCredit(monto: number): Observable<any> {
    return this.http.post(`${API_URL}/credit/pay`, { monto });
  }

  getPayments(): Observable<any> {
    return this.http.get(`${API_URL}/credit/payments/history`);
  }

  getRequestHistory(): Observable<any> {
    return this.http.get(`${API_URL}/credit/requests/history`);
  }
}
