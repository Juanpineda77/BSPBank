import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ClientService, ClienteActual } from '../../core/client.service';
import { ToastService } from '../../core/toast.service';
import { API_URL } from '../../core/api.config';

@Component({
  selector: 'app-transfer',
  standalone: true,
  templateUrl: './transfer.html',
  styleUrls: ['./transfer.css'],
  imports: [CommonModule, FormsModule]
})
export class Transfer implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private clientService = inject(ClientService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  cliente: ClienteActual | null = null;
  enviando = false;

  transferencia = {
    nombre_beneficiario: '',
    clabe_beneficiario: '',
    autenticacion: 'app',
    monto: null as number | null,
    moneda: 'MXN',
    concepto: ''
  };

  ngOnInit(): void {
    this.clientService.getCurrent().subscribe({
      next: cliente => (this.cliente = cliente),
      error: () => this.toast.error('No se pudieron cargar tus datos.')
    });
  }

  get saldoInsuficiente(): boolean {
    const monto = this.transferencia.monto;
    const saldo = this.cliente?.saldo;
    return monto != null && saldo != null && monto > Number(saldo);
  }

  async enviarTransferencia(): Promise<void> {
    if (this.enviando) return;

    if (this.saldoInsuficiente) {
      this.toast.error('El monto supera tu saldo disponible.');
      return;
    }

    this.enviando = true;
    try {
      const respuesta: any = await firstValueFrom(
        this.http.post(`${API_URL}/transferir`, this.transferencia)
      );

      // El saldo cambió: invalidamos la copia en caché.
      this.clientService.refresh().subscribe({ error: () => {} });

      this.router.navigate(['/transfer-success'], {
        state: { comprobante: respuesta?.comprobante }
      });
    } catch (error: any) {
      this.toast.error(error?.error?.message || 'Error al procesar la transferencia.');
    } finally {
      this.enviando = false;
    }
  }

  onLogout(): void {
    this.auth.logout();
  }
}
