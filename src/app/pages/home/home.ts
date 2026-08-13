import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/**
 * Punto de entrada tras iniciar sesión: manda a cada usuario al panel
 * que le corresponde según su rol.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  template: `<p class="redirecting">Cargando tu panel…</p>`,
  styles: [`
    .redirecting {
      padding: 2rem;
      text-align: center;
      font: 500 1rem system-ui, sans-serif;
      color: #555;
    }
  `]
})
export class Home implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    this.router.navigateByUrl(this.auth.homeRouteForRole(), { replaceUrl: true });
  }
}
