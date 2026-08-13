import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-ejecutive',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ejecutive.html',
  styleUrls: ['./ejecutive.css']
})
export class Ejecutive {
  private auth = inject(AuthService);

  /** El nombre real del ejecutivo requiere un endpoint que el backend aún no expone. */
  email = this.auth.getEmailFromToken();

  onLogout(): void {
    this.auth.logout();
  }
}
