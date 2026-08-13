import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api.config';

/**
 * Inicio de sesión sin contraseña (huella / Face ID) con WebAuthn.
 *
 * El navegador trabaja con ArrayBuffer y el backend con base64url,
 * así que aquí vive toda la conversión entre ambos formatos.
 */
@Injectable({ providedIn: 'root' })
export class WebauthnService {
  private http = inject(HttpClient);

  /** ¿El navegador soporta autenticadores de plataforma? */
  get soportado(): boolean {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  }

  /**
   * Registra la biometría del dispositivo para la cuenta en sesión.
   * El backend toma el email del JWT, no del cliente.
   */
  async registrar(): Promise<void> {
    if (!this.soportado) {
      throw new Error('Tu dispositivo o navegador no soporta biometría.');
    }

    const options: any = await firstValueFrom(
      this.http.post(`${API_URL}/webauthn/register-options`, {})
    );

    const publicKey: PublicKeyCredentialCreationOptions = {
      ...options,
      challenge: this.toBuffer(options.challenge),
      user: {
        ...options.user,
        id: this.toBuffer(options.user.id)
      },
      excludeCredentials: (options.excludeCredentials ?? []).map((cred: any) => ({
        ...cred,
        id: this.toBuffer(cred.id)
      }))
    };

    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
    if (!credential) throw new Error('No se pudo crear la credencial.');

    const response = credential.response as AuthenticatorAttestationResponse;
    const attestationResponse = {
      id: credential.id,
      rawId: this.toBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.toBase64url(response.clientDataJSON),
        attestationObject: this.toBase64url(response.attestationObject)
      }
    };

    const result: any = await firstValueFrom(
      this.http.post(`${API_URL}/webauthn/register`, { attestationResponse })
    );

    if (!result?.verified) {
      throw new Error(result?.error || 'No se pudo verificar la biometría.');
    }
  }

  /** Desactiva el acceso biométrico de la cuenta en sesión. */
  async desactivar(): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/webauthn/disable`, {}));
  }

  /**
   * Autentica con biometría. Devuelve el token y rol emitidos por el backend.
   * Se usa antes de tener sesión, por eso el email va explícito.
   */
  async login(email: string): Promise<{ token: string; role: string; redirectTo: string }> {
    if (!this.soportado) {
      throw new Error('Tu dispositivo o navegador no soporta biometría.');
    }

    const options: any = await firstValueFrom(
      this.http.post(`${API_URL}/webauthn/login-options`, { email })
    );

    const publicKey: PublicKeyCredentialRequestOptions = {
      ...options,
      challenge: this.toBuffer(options.challenge),
      allowCredentials: (options.allowCredentials ?? []).map((cred: any) => ({
        ...cred,
        id: this.toBuffer(cred.id)
      }))
    };

    const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
    if (!assertion) throw new Error('No se pudo obtener la credencial.');

    const response = assertion.response as AuthenticatorAssertionResponse;
    const assertionResponse = {
      id: assertion.id,
      rawId: this.toBase64url(assertion.rawId),
      type: assertion.type,
      response: {
        clientDataJSON: this.toBase64url(response.clientDataJSON),
        authenticatorData: this.toBase64url(response.authenticatorData),
        signature: this.toBase64url(response.signature),
        userHandle: response.userHandle ? this.toBase64url(response.userHandle) : null
      }
    };

    const result: any = await firstValueFrom(
      this.http.post(`${API_URL}/webauthn/login`, { email, assertionResponse })
    );

    // El backend responde { token, account: { id, email, role }, redirectTo }
    if (!result?.token) {
      throw new Error(result?.error || 'No se pudo iniciar sesión con biometría.');
    }

    return {
      token: result.token,
      role: result.account?.role ?? '',
      redirectTo: result.redirectTo ?? '/home'
    };
  }

  /** Mensaje legible para los errores típicos del autenticador. */
  mensajeDeError(error: any): string {
    switch (error?.name) {
      case 'NotAllowedError':
        return 'Operación cancelada o sin permiso del dispositivo.';
      case 'NotSupportedError':
        return 'Tu dispositivo no soporta biometría.';
      case 'InvalidStateError':
        return 'Este dispositivo ya está registrado para esta cuenta.';
      default:
        return error?.error?.message || error?.message || 'Error con la autenticación biométrica.';
    }
  }

  private toBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const raw = atob(padded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes.buffer;
  }

  private toBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
