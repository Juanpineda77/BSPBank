import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { FormsModule } from '@angular/forms';
import 'zone.js';

import { App } from './app/app';
import { routes } from './app/app.routes';

// Esta ruta debe ser correcta
import { AuthInterceptor } from './app/core/auth.interceptor';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(
      withInterceptors([AuthInterceptor])
    ),
    provideRouter(routes),
    importProvidersFrom(FormsModule)
  ]
})
.catch(err => console.error(err));
