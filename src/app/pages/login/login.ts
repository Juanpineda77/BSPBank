import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { WebauthnService } from '../../core/webauthn.service';
import { ToastService } from '../../core/toast.service';
import { API_URL } from '../../core/api.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private webauthn = inject(WebauthnService);
  private toast = inject(ToastService);

  email = '';
  password = '';

  /** El backend pidió biometría para esta cuenta. */
  biometricEnabled = false;
  biometricEmail = '';
  enviando = false;

  login(): void {
    if (this.enviando) return;

    this.enviando = true;
    this.http
      .post<any>(`${API_URL}/login`, { email: this.email, password: this.password })
      .subscribe({
        next: res => {
          this.enviando = false;

          // Cuenta con biometría: no hay token todavía, se pide la huella.
          if (res?.webauthnRequired) {
            this.biometricEnabled = true;
            this.biometricEmail = this.email;
            this.toast.info('Esta cuenta usa inicio de sesión con huella.');
            return;
          }

          if (!res?.token) {
            this.toast.error('No se recibió un token válido.');
            return;
          }

          this.auth.login(res.token, res.account?.role);
          this.redirigir(res.redirectTo);
        },
        error: err => {
          this.enviando = false;
          this.toast.error(err?.error?.message || 'Error al iniciar sesión.');
        }
      });
  }

  async loginBiometrico(): Promise<void> {
    const email = this.biometricEmail || this.email;

    if (!email) {
      this.toast.error('Ingresa tu email para usar la huella.');
      return;
    }

    if (this.enviando) return;
    this.enviando = true;

    try {
      const { token, role, redirectTo } = await this.webauthn.login(email);
      this.auth.login(token, role);
      this.redirigir(redirectTo);
    } catch (error) {
      this.toast.error(this.webauthn.mensajeDeError(error));
    } finally {
      this.enviando = false;
    }
  }

  /** Respeta el returnUrl que dejó el guard al expulsar al usuario. */
  private redirigir(fallback?: string): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(returnUrl || fallback || this.auth.homeRouteForRole());
  }
}
