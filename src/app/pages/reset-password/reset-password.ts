import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../core/toast.service';
import { API_URL } from '../../core/api.config';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css']
})
export class ResetPassword {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  token = this.route.snapshot.queryParamMap.get('token') ?? '';
  password = '';
  confirmacion = '';
  enviando = false;

  get tokenPresente(): boolean {
    return this.token.length > 0;
  }

  get coinciden(): boolean {
    return this.password.length > 0 && this.password === this.confirmacion;
  }

  onSubmit(): void {
    if (!this.tokenPresente) {
      this.toast.error('El enlace no es válido. Solicita uno nuevo.');
      return;
    }
    if (!this.coinciden || this.enviando) return;

    this.enviando = true;
    this.http
      .post(`${API_URL}/password-reset`, { token: this.token, newPassword: this.password })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.toast.success('Contraseña actualizada. Inicia sesión.');
          this.router.navigate(['/login']);
        },
        error: err => {
          this.enviando = false;
          this.toast.error(err?.error?.message || 'El enlace es inválido o expiró.');
        }
      });
  }
}
