import { environment } from '../../environments/environment';

/**
 * URL base del backend.
 *
 * Se toma del archivo de entorno para no dejarla fija en el código:
 * al compilar en producción Angular sustituye `environment.ts` por
 * `environment.prod.ts` (ver `fileReplacements` en angular.json).
 */
export const API_URL = environment.apiUrl;
