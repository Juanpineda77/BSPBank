import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CreditOffer } from '../../models/credit-offer.model';
import { CreditService } from '../../core/services/credit.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-credit-offers',
  standalone: true,
  templateUrl: './credit-offers.html',
  styleUrls: ['./credit-offers.css'],
  imports: [CommonModule]
})
export class CreditOffers {
  private router = inject(Router);
  private creditService = inject(CreditService);
  private toast = inject(ToastService);

  offers: CreditOffer[] = this.creditService.getCreditOffers();
  validando = false;

  solicitar(oferta: CreditOffer): void {
    this.validando = true;

    this.creditService.checkEligibility().subscribe({
      next: ({ creditoActivo, maxMontoPermitido }) => {
        this.validando = false;

        if (creditoActivo) {
          this.toast.error('Ya tienes un crédito activo. Debes liquidarlo primero.');
          return;
        }

        if (oferta.monto > maxMontoPermitido) {
          const max = maxMontoPermitido.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN'
          });
          this.toast.error(`El monto excede lo permitido para tu ingreso. Máximo: ${max}`);
          return;
        }

        this.router.navigate(['/credit-request'], { state: oferta });
      },
      error: () => {
        this.validando = false;
        this.toast.error('Error validando la solicitud. Intenta más tarde.');
      }
    });
  }
}
