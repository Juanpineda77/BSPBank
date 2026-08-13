import { Routes } from '@angular/router';

import { authGuard, roleGuard, guestOnlyGuard } from './core/guards';

import { PasswordChange } from './pages/password-change/password-change';
import { ResetPassword } from './pages/reset-password/reset-password';
import { Transfer } from './pages/transfer/transfer';
import { TransferSuccess } from './pages/transfer-success/transfer-success';
import { Login } from './pages/login/login';
import { Ejecutive } from './pages/ejecutive/ejecutive';
import { Home } from './pages/home/home';
import { Formulario } from './pages/formulario/formulario';
import { Cliente } from './cliente/cliente';
import { Gerente } from './pages/gerente/gerente';
import { Forbidden } from './pages/forbidden/forbidden';

// Crédito
import { CreditOffers } from './pages/credit-offers/credit-offers';
import { CreditRequest } from './pages/credit-request/credit-request';
import { CreditActive } from './pages/credit-active/credit-active';
import { CreditPayments } from './pages/credit-payments/credit-payments';
import { AccountStatement } from './pages/account-statement/account-statement';

export const routes: Routes = [
  // Públicas
  { path: 'login', component: Login, canActivate: [guestOnlyGuard] },
  { path: 'formulario', component: Formulario, canActivate: [guestOnlyGuard] },
  { path: 'password-change', component: PasswordChange },
  { path: 'reset-password', component: ResetPassword },
  { path: 'forbidden', component: Forbidden },

  // Redirige al panel que corresponde al rol de la sesión
  { path: 'home', component: Home, canActivate: [authGuard] },

  // Cliente
  { path: 'cliente', component: Cliente, canActivate: [roleGuard], data: { roles: ['cliente'] } },
  { path: 'credit-offers', component: CreditOffers, canActivate: [roleGuard], data: { roles: ['cliente'] } },
  { path: 'credit-request', component: CreditRequest, canActivate: [roleGuard], data: { roles: ['cliente'] } },
  { path: 'credit-active', component: CreditActive, canActivate: [roleGuard], data: { roles: ['cliente'] } },
  { path: 'credit-payments', component: CreditPayments, canActivate: [roleGuard], data: { roles: ['cliente'] } },
  { path: 'account-statement', component: AccountStatement, canActivate: [roleGuard], data: { roles: ['cliente'] } },
  { path: 'transfer', component: Transfer, canActivate: [roleGuard], data: { roles: ['cliente'] } },
  { path: 'transfer-success', component: TransferSuccess, canActivate: [roleGuard], data: { roles: ['cliente'] } },

  // Ejecutivo
  { path: 'ejecutive', component: Ejecutive, canActivate: [roleGuard], data: { roles: ['ejecutivo'] } },

  // Gerente
  { path: 'gerente', component: Gerente, canActivate: [roleGuard], data: { roles: ['gerente'] } },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
