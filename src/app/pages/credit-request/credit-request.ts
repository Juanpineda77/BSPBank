import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { ClientService, ClienteActual } from '../../core/client.service';
import { CreditService } from '../../core/services/credit.service';
import { ToastService } from '../../core/toast.service';
import { CreditOffer } from '../../models/credit-offer.model';

@Component({
  selector: 'app-credit-request',
  standalone: true,
  templateUrl: './credit-request.html',
  styleUrls: ['./credit-request.css'],
  imports: [CommonModule, FormsModule]
})
export class CreditRequest implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private clientService = inject(ClientService);
  private creditService = inject(CreditService);
  private toast = inject(ToastService);

  cliente: ClienteActual | null = null;
  oferta: CreditOffer | null = null;

  ingreso = 0;
  monto = 0;
  plazo = 12;
  plazos = [6, 12, 18, 24];

  cuotaMensual = 0;
  total = 0;
  interes = 0;
  enviando = false;

  ngOnInit(): void {
    this.clientService.getCurrent().subscribe({
      next: cliente => (this.cliente = cliente),
      error: () => this.toast.error('No se pudieron cargar tus datos.')
    });

    // La oferta llega por el state de la navegación desde /credit-offers
    const state = history.state as Partial<CreditOffer> | undefined;
    if (!state?.monto || !state?.interes) {
      this.router.navigate(['/credit-offers']);
      return;
    }

    this.oferta = state as CreditOffer;
    this.monto = this.oferta.monto;
    this.interes = this.oferta.interes;
    this.calcular();
  }

  /** Cuota fija mensual (sistema francés). */
  calcular(): void {
    const i = this.interes / 100 / 12;
    if (!this.monto || !this.plazo) {
      this.cuotaMensual = 0;
      this.total = 0;
      return;
    }
    this.cuotaMensual = i > 0
      ? (this.monto * i) / (1 - Math.pow(1 + i, -this.plazo))
      : this.monto / this.plazo;
    this.total = this.cuotaMensual * this.plazo;
  }

  get formValido(): boolean {
    return this.ingreso > 0 && this.monto > 0 && this.plazo > 0;
  }

  enviarSolicitud(): void {
    if (!this.formValido || this.enviando) return;

    this.enviando = true;
    this.creditService
      .requestCredit({ ingreso: this.ingreso, monto: this.monto, plazo: this.plazo })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.toast.success('Crédito aprobado y activado.');
          this.router.navigate(['/credit-active']);
        },
        error: err => {
          this.enviando = false;
          this.toast.error(err?.error?.message || 'Error al procesar la solicitud.');
        }
      });
  }

  onLogout(): void {
    this.auth.logout();
  }
}
