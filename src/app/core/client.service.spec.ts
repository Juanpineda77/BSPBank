import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ClientService } from './client.service';
import { API_URL } from './api.config';

describe('ClientService', () => {
  let service: ClientService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ClientService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ClientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('calcula las iniciales a partir del nombre', () => {
    expect(ClientService.iniciales('Ana Torres')).toBe('AT');
    expect(ClientService.iniciales('maría del carmen lópez')).toBe('MD');
    expect(ClientService.iniciales('  Ana   Torres  ')).toBe('AT');
    expect(ClientService.iniciales(undefined)).toBe('');
    expect(ClientService.iniciales('')).toBe('');
  });

  it('normaliza la respuesta del backend', () => {
    let cliente: any;
    service.getCurrent().subscribe(c => (cliente = c));

    httpMock.expectOne(`${API_URL}/cliente/actual`).flush({
      nombre: 'Ana Torres',
      nivel: 'Premium',
      saldo: 1234.5,
      webauthn_enabled: 1
    });

    expect(cliente.iniciales).toBe('AT');
    expect(cliente.saldo).toBe(1234.5);
    expect(cliente.webauthn_enabled).toBe(1);
  });

  it('reutiliza la respuesta en vez de pedirla en cada pantalla', () => {
    service.getCurrent().subscribe();
    httpMock.expectOne(`${API_URL}/cliente/actual`).flush({ nombre: 'Ana Torres', saldo: 0 });

    service.getCurrent().subscribe();
    httpMock.expectNone(`${API_URL}/cliente/actual`);
  });

  it('refresh vuelve a consultar al backend', () => {
    service.getCurrent().subscribe();
    httpMock.expectOne(`${API_URL}/cliente/actual`).flush({ nombre: 'Ana Torres', saldo: 0 });

    service.refresh().subscribe();
    httpMock.expectOne(`${API_URL}/cliente/actual`).flush({ nombre: 'Ana Torres', saldo: 99 });
  });
});
