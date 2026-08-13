import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatementService } from '../../core/services/statement.service';
import { AuthService } from '../../core/auth.service';
import { ClientService, ClienteActual } from '../../core/client.service';
import { ToastService } from '../../core/toast.service';
import { Statement } from '../../models/statement.model';

@Component({
  selector: 'app-account-statement',
  standalone: true,
  templateUrl: './account-statement.html',
  styleUrls: ['./account-statement.css'],
  imports: [CommonModule, FormsModule]
})
export class AccountStatement implements OnInit {
  private statementService = inject(StatementService);
  private clientService = inject(ClientService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  cliente: ClienteActual | null = null;
  statement: Statement = { movimientos: [] };
  selectedMonth = '';
  cargando = false;
  descargando = false;

  ngOnInit(): void {
    this.clientService.getCurrent().subscribe({
      next: cliente => (this.cliente = cliente),
      error: () => this.toast.error('No se pudieron cargar tus datos.')
    });
  }

  loadStatement(month: string): void {
    if (!month) return;

    this.cargando = true;
    this.statementService.getStatementByMonth(month).subscribe({
      next: res => {
        this.statement = { ...res, movimientos: res?.movimientos ?? [] };
        this.cargando = false;
      },
      error: () => {
        this.statement = { movimientos: [] };
        this.cargando = false;
        this.toast.error('No se pudo cargar el estado de cuenta.');
      }
    });
  }

  downloadPDF(): void {
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

  onLogout(): void {
    this.auth.logout();
  }
}
