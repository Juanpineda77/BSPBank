import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../core/toast.service';
import { API_URL } from '../../core/api.config';

@Component({
  selector: 'app-formulario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './formulario.html',
  styleUrls: ['./formulario.css']
})
export class Formulario {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);

  nombre = '';
  email = '';
  telefono = '';
  password = '';
  fecha = '';
  ine = '';
  rol = 'cliente';
  enviando = false;

  registro(): void {
    if (this.enviando) return;

    this.enviando = true;
    this.http
      .post<any>(`${API_URL}/formulario`, {
        email: this.email,
        password: this.password,
        nombre: this.nombre,
        telefono: this.telefono,
        fecha: this.fecha,
        ine: this.ine,
        rol: this.rol
      })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.toast.success('Cuenta creada. Ya puedes iniciar sesión.');
          this.router.navigate(['/login']);
        },
        error: err => {
          this.enviando = false;
          this.toast.error(err?.error?.message || 'Error al registrarse.');
        }
      });
  }
}
