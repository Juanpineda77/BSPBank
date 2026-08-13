import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ClientService, ClienteActual } from '../core/client.service';
import { WebauthnService } from '../core/webauthn.service';
import { ToastService } from '../core/toast.service';
import { StatementService } from '../core/services/statement.service';

@Component({
  selector: 'app-cliente',
  standalone: true,
  templateUrl: './cliente.html',
  styleUrls: ['./cliente.css'],
  imports: [CommonModule, RouterLink]
})
export class Cliente implements OnInit {
  private router = inject(Router);
  private clientService = inject(ClientService);
  private statementService = inject(StatementService);
  private webauthn = inject(WebauthnService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  cliente: ClienteActual | null = null;
  biometriaActiva = false;
  procesandoBiometria = false;
  descargando = false;

  get biometriaSoportada(): boolean {
    return this.webauthn.soportado;
  }

  ngOnInit(): void {
    this.clientService.getCurrent().subscribe({
      next: cliente => {
        this.cliente = cliente;
        this.biometriaActiva = cliente.webauthn_enabled === 1;
      },
      error: err => {
        if (err?.status === 401 || err?.status === 403) {
          this.auth.logout();
          return;
        }
        this.toast.error('No se pudieron cargar tus datos.');
      }
    });
  }

  async activarBiometria(): Promise<void> {
    if (this.procesandoBiometria) return;

    this.procesandoBiometria = true;
    try {
      await this.webauthn.registrar();
      this.biometriaActiva = true;
      this.toast.success('Inicio de sesión con huella activado.');
    } catch (error) {
      this.toast.error(this.webauthn.mensajeDeError(error));
    } finally {
      this.procesandoBiometria = false;
    }
  }

  async desactivarBiometria(): Promise<void> {
    if (this.procesandoBiometria) return;

    this.procesandoBiometria = true;
    try {
      await this.webauthn.desactivar();
      this.biometriaActiva = false;
      this.toast.success('Inicio de sesión con huella desactivado.');
    } catch (error) {
      this.toast.error(this.webauthn.mensajeDeError(error));
    } finally {
      this.procesandoBiometria = false;
    }
  }

  descargarEstadoDeCuenta(): void {
    this.descargando = true;
    this.statementService.downloadStatementPDF().subscribe({
      next: file => {
        const url = window.URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'estado_cuenta.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
        this.descargando = false;
        this.toast.success('Estado de cuenta descargado.');
      },
      error: () => {
        this.descargando = false;
        this.toast.error('Hubo un error al generar tu estado de cuenta.');
      }
    });
  }

  goToAccountStatement(): void {
    this.router.navigate(['/account-statement']);
  }

  onLogout(): void {
    this.auth.logout();
  }
}
