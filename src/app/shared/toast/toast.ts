import { Component, inject } from '@angular/core';
import { NgClass, NgFor } from '@angular/common';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgFor, NgClass],
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      <div
        *ngFor="let t of toastService.toasts()"
        class="toast"
        [ngClass]="'toast--' + t.type"
        (click)="toastService.dismiss(t.id)"
      >
        <span class="toast__icon">{{ icon(t.type) }}</span>
        <span class="toast__msg">{{ t.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    /* Abajo a la derecha: arriba taparía el botón de logout del header. */
    .toast-stack {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: .5rem;
      max-width: min(90vw, 22rem);
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: .6rem;
      padding: .75rem 1rem;
      border-radius: .5rem;
      background: #fff;
      color: #1a1a1a;
      box-shadow: 0 6px 24px rgba(0, 0, 0, .18);
      border-left: 4px solid #999;
      cursor: pointer;
      font: 500 .9rem/1.35 system-ui, sans-serif;
      animation: toast-in .18s ease-out;
    }
    .toast--success { border-left-color: #007a33; }
    .toast--error   { border-left-color: #b00020; }
    .toast--info    { border-left-color: #0b63ce; }
    .toast__icon { flex: none; }
    .toast__msg { word-break: break-word; }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast { animation: none; }
    }
  `]
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  icon(type: string): string {
    if (type === 'success') return '✓';
    if (type === 'error') return '✕';
    return 'i';
  }
}
