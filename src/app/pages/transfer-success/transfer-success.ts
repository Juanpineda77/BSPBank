import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { ClientService, ClienteActual } from '../../core/client.service';
import { ToastService } from '../../core/toast.service';
import { API_URL } from '../../core/api.config';

@Component({
  selector: 'app-transfer-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transfer-success.html',
  styleUrls: ['./transfer-success.css']
})
export class TransferSuccess implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private clientService = inject(ClientService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  comprobante?: string;
  cliente: ClienteActual | null = null;
  fechaHoy = new Date();
  descargando = false;

  constructor() {
    this.comprobante = this.router.getCurrentNavigation()?.extras?.state?.['comprobante'];
  }

  ngOnInit(): void {
    this.clientService.getCurrent().subscribe({
      next: cliente => (this.cliente = cliente),
      error: () => this.toast.error('No se pudieron cargar tus datos.')
    });
  }

  /**
   * El endpoint exige el JWT, así que no se puede abrir en una pestaña
   * nueva: se descarga vía HttpClient (el interceptor pone el token).
   */
  descargarComprobante(): void {
    if (!this.comprobante) return;

    this.descargando = true;
    this.http
      .get(`${API_URL}/comprobantes/${this.comprobante}`, { responseType: 'blob' })
      .subscribe({
        next: file => {
          const url = window.URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = this.comprobante!;
          a.click();
          window.URL.revokeObjectURL(url);
          this.descargando = false;
        },
        error: () => {
          this.descargando = false;
          this.toast.error('No se pudo descargar el comprobante.');
        }
      });
  }

  goToCliente(): void {
    this.router.navigate(['/cliente']);
  }

  onLogout(): void {
    this.auth.logout();
  }
}
