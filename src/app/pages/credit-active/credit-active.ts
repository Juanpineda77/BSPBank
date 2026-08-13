import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { ClientService, ClienteActual } from '../../core/client.service';
import { CreditService } from '../../core/services/credit.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-credit-active',
  standalone: true,
  templateUrl: './credit-active.html',
  styleUrls: ['./credit-active.css'],
  imports: [CommonModule]
})
export class CreditActive implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private clientService = inject(ClientService);
  private creditService = inject(CreditService);
  private toast = inject(ToastService);

  cliente: ClienteActual | null = null;
  credit: any = null;
  loading = true;

  ngOnInit(): void {
    this.clientService.getCurrent().subscribe({
      next: cliente => (this.cliente = cliente),
      error: () => this.toast.error('No se pudieron cargar tus datos.')
    });

    this.creditService.getActiveCredit().subscribe({
      next: (res: any) => {
        this.credit = res?.credit ?? null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('No se pudo cargar tu crédito activo.');
      }
    });
  }

  goToPayments() { this.router.navigate(['/credit-payments']); }
  goToRequest() { this.router.navigate(['/credit-offers']); }
  goToOffers() { this.router.navigate(['/credit-offers']); }
  goToDashboard() { this.router.navigate(['/cliente']); }

  onLogout(): void {
    this.auth.logout();
  }
}
