import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { AuthService } from '../auth.service';
import { Statement } from '../../models/statement.model';

/**
 * Estado de cuenta del cliente autenticado.
 * El token lo adjunta el interceptor.
 */
@Injectable({ providedIn: 'root' })
export class StatementService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  /** Movimientos de un mes concreto (`YYYY-MM`). */
  getStatementByMonth(month: string): Observable<Statement> {
    const userId = this.auth.getUserId();
    return this.http.get<Statement>(`${API_URL}/statement/${userId}/${month}`);
  }

  /** Estado de cuenta completo en PDF. */
  downloadStatementPDF(): Observable<Blob> {
    const userId = this.auth.getUserId();
    return this.http.get(`${API_URL}/account-statement/${userId}`, {
      responseType: 'blob'
    });
  }
}
