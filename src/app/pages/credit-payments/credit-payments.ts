import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CreditService } from '../../core/services/credit.service';
import { AuthService } from '../../core/auth.service';
import { ClientService, ClienteActual } from '../../core/client.service';
import { ToastService } from '../../core/toast.service';

interface Payment {
  id_pago: number;
  monto: number;
  fecha: string;
}

@Component({
  selector: 'app-credit-payments',
  standalone: true,
  templateUrl: './credit-payments.html',
  styleUrls: ['./credit-payments.css'],
  imports: [CommonModule, FormsModule]
})
export class CreditPayments implements OnInit {
  private creditService = inject(CreditService);
  private clientService = inject(ClientService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  cliente: ClienteActual | null = null;
  payments: Payment[] = [];
  montoPago: number | null = null;
  loading = true;
  pagando = false;

  ngOnInit(): void {
    this.clientService.getCurrent().subscribe({
      next: cliente => (this.cliente = cliente),
      error: () => this.toast.error('No se pudieron cargar tus datos.')
    });

    this.loadPayments();
  }

  loadPayments(): void {
    this.loading = true;
    this.creditService.getPayments().subscribe({
      next: (res: any) => {
        this.payments = res?.pagos ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('No se pudieron obtener tus pagos.');
      }
    });
  }

  get montoValido(): boolean {
    return this.montoPago != null && this.montoPago > 0;
  }

  pagar(): void {
    if (!this.montoValido || this.pagando) {
      if (!this.montoValido) this.toast.error('Ingresa un monto mayor a cero.');
      return;
    }

    this.pagando = true;
    this.creditService.payCredit(this.montoPago!).subscribe({
      next: () => {
        this.pagando = false;
        this.montoPago = null;
        this.toast.success('Pago realizado con éxito.');
        this.loadPayments();
      },
      error: err => {
        this.pagando = false;
        this.toast.error(err?.error?.message || 'Error al procesar el pago.');
      }
    });
  }

  volver(): void {
    this.router.navigate(['/credit-active']);
  }

  onLogout(): void {
    this.auth.logout();
  }
}
