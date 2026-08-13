import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-gerente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gerente.html',
  styleUrls: ['./gerente.css']
})
export class Gerente {
  private auth = inject(AuthService);

  /** El nombre real del gerente requiere un endpoint que el backend aún no expone. */
  email = this.auth.getEmailFromToken();

  onLogout(): void {
    this.auth.logout();
  }
}
