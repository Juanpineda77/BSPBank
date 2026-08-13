import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CreditService } from './credit.service';
import { API_URL } from '../api.config';

describe('CreditService', () => {
  let service: CreditService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CreditService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CreditService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('paga contra /credit/pay mandando el monto en el body', () => {
    // Regresión: antes apuntaba a /credit/pay/:id, ruta que el backend no expone.
    service.payCredit(500).subscribe();

    const req = httpMock.expectOne(`${API_URL}/credit/pay`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ monto: 500 });
    req.flush({ message: 'ok' });
  });

  it('consulta el historial de pagos en /credit/payments/history', () => {
    service.getPayments().subscribe();

    const req = httpMock.expectOne(`${API_URL}/credit/payments/history`);
    expect(req.request.method).toBe('GET');
    req.flush({ pagos: [] });
  });

  it('consulta el crédito activo sin id en la URL', () => {
    // El backend identifica al cliente por el JWT.
    service.getActiveCredit().subscribe();

    const req = httpMock.expectOne(`${API_URL}/credit/active`);
    expect(req.request.method).toBe('GET');
    req.flush({ credit: null });
  });

  it('valida elegibilidad contra /credit/check', () => {
    let respuesta: any;
    service.checkEligibility().subscribe(r => (respuesta = r));

    const req = httpMock.expectOne(`${API_URL}/credit/check`);
    req.flush({ creditoActivo: false, ingresoMensual: 20000, maxMontoPermitido: 144000 });

    expect(respuesta.maxMontoPermitido).toBe(144000);
  });

  it('expone las ofertas del catálogo', () => {
    const offers = service.getCreditOffers();
    expect(offers.length).toBe(3);
    expect(offers[0].titulo).toBe('Crédito Personal');
  });
});
