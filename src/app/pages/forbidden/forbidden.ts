import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div style="padding:2rem;text-align:center">
      <h1>403</h1>
      <p>No tienes permisos para ver esta página.</p>
      <a routerLink="/home">Volver</a>
    </div>
  `
})
export class Forbidden {}