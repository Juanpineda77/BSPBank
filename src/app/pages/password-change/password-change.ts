import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../core/toast.service';
import { API_URL } from '../../core/api.config';

@Component({
  selector: 'app-password-change',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './password-change.html',
  styleUrls: ['./password-change.css']
})
export class PasswordChange {
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  email = '';
  enviando = false;
  enviado = false;

  onSubmit(): void {
    if (!this.email || this.enviando) return;

    this.enviando = true;
    this.http.post(`${API_URL}/password-reset-request`, { email: this.email }).subscribe({
      next: () => {
        this.enviando = false;
        this.enviado = true;
        this.toast.success('Te enviamos un enlace de recuperación a tu correo.');
      },
      error: err => {
        this.enviando = false;
        this.toast.error(err?.error?.message || 'No se pudo enviar el enlace. Intenta más tarde.');
      }
    });
  }
}
