import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { AuthInterceptor } from './auth.interceptor';

describe('AuthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([AuthInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('adjunta el token cuando hay sesión', () => {
    localStorage.setItem('token', 'abc123');

    http.get('/datos').subscribe();

    const req = httpMock.expectOne('/datos');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush({});
  });

  it('no manda cabecera cuando no hay token', () => {
    http.get('/datos').subscribe();

    const req = httpMock.expectOne('/datos');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
