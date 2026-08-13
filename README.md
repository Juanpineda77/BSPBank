# BSPBank

Aplicación de banca digital ficticia ("BSP Union") con paneles separados para cliente, ejecutivo y gerente, autenticación con JWT, inicio de sesión biométrico (WebAuthn) y flujos completos de crédito y transferencias. Frontend en Angular, backend en Express + MySQL.

![Login](docs/screenshots/login.png)

## Sobre el proyecto

BSPBank simula el panel de un banco con tres roles de usuario, cada uno con su propia vista y permisos. Empezó como proyecto de equipo para la universidad; yo lideré el desarrollo e implementé la mayor parte del frontend, el backend y la integración entre ambos.

A diferencia de un mockup, aquí hay lógica real: autenticación con JWT, guards de ruta por rol, un backend en Express con MySQL, correo de recuperación de contraseña, generación de PDFs y soporte para inicio de sesión biométrico vía WebAuthn.

## Funcionalidades

- **Autenticación:** login con email y contraseña, JWT con expiración, recuperación y cambio de contraseña por correo.
- **Biometría (WebAuthn):** alta, baja y verificación de huella o Face ID como método de acceso alterno.
- **Control de acceso por rol:** cada ruta valida sesión y rol (`cliente`, `ejecutivo`, `gerente`) antes de permitir el paso; redirige a `/login` conservando el destino, o a `/forbidden` si el rol no corresponde.
- **Panel Cliente:** saldo, transferencias frecuentes, actividad reciente, tarjetas y estado de cuenta.
- **Crédito:** catálogo de ofertas, validación de elegibilidad contra el ingreso declarado, simulador de cuota (sistema francés), seguimiento del crédito activo y registro de pagos.
- **Transferencias:** envío con validación de saldo, pantalla de confirmación y comprobante en PDF descargable.
- **Panel Ejecutivo:** apertura y cierre de cuentas, consulta de cuentas, solicitudes de crédito.
- **Panel Gerente:** actividad de ejecutivos, aclaraciones pendientes, gestión de permisos.
- **Alta de cliente:** formulario con validación en el cliente y documentos de identidad.

## Capturas

**Panel Cliente**
![Cliente](docs/screenshots/cliente.png)

**Ofertas de crédito**
![Créditos](docs/screenshots/credit-offers.png)

**Crédito activo**
![Crédito activo](docs/screenshots/credit-active.png)

**Estado de cuenta**
![Estado de cuenta](docs/screenshots/account-statement.png)

**Transferencia**
![Transferencia](docs/screenshots/transfer.png)

**Panel Ejecutivo**
![Ejecutivo](docs/screenshots/ejecutive.png)

**Panel Gerente**
![Gerente](docs/screenshots/gerente.png)

## Stack técnico

**Frontend**

- [Angular 20](https://angular.dev/) con componentes standalone
- Angular Router con guards funcionales (`CanActivateFn`)
- RxJS + `HttpClient` con interceptor que adjunta el JWT a cada petición
- `jwt-decode` para leer el payload del token (id, email, rol y expiración)
- Karma + Jasmine para las pruebas unitarias

**Backend** (`/backend`)

- Node.js + Express
- MySQL (`mysql2`) con consultas parametrizadas
- `bcrypt` para el hash de contraseñas, `jsonwebtoken` para las sesiones
- `@simplewebauthn/server` para el registro y verificación biométrica
- `nodemailer` para el correo de recuperación
- `pdfkit` para los comprobantes y el estado de cuenta en PDF

## Decisiones de seguridad

El proyecto maneja datos financieros simulados, así que el control de acceso se trató como parte del diseño y no como un añadido:

- **La identidad sale siempre del JWT, nunca de la URL o del body.** Los endpoints que reciben un `:userId` comparan contra el token y responden `403` si no coinciden, para que nadie pueda leer el estado de cuenta de otra persona cambiando un número en la URL.
- **Descarga de comprobantes autenticada y con nombre validado** contra un patrón fijo, de modo que la ruta del archivo no se pueda manipular para salir de su carpeta.
- **El registro biométrico exige sesión iniciada** y toma el correo del token: así nadie puede vincular su huella a una cuenta ajena.
- **Contraseñas con `bcrypt`** y consultas parametrizadas en todas las llamadas a MySQL.
- **Ningún secreto en el repositorio:** `backend/.env` está en `.gitignore` y se documenta con `backend/.env.example`.

## Cómo correrlo localmente

Requisitos: Node.js 20 o superior, npm y, para el backend completo, una base de datos MySQL.

**Frontend**

```bash
npm install
npm start
```

Abre `http://localhost:4200`; la app redirige a `/login`. Sin el backend en marcha se pueden ver las pantallas públicas (login, registro, recuperación); las demás necesitan una sesión real.

**Backend**

```bash
cd backend
npm install
cp .env.example .env   # completa tus credenciales de MySQL, JWT y correo
node server.js
```

El backend escucha en `http://localhost:3000`.

> El repositorio no incluye ningún `.env` real ni credenciales: usa `backend/.env.example` como plantilla.

## Pruebas

```bash
npm test        # modo interactivo, con navegador
npm run test:ci # headless, para CI
```

Cubren el servicio de sesión (token válido, expirado y corrupto; resolución de rol), los tres guards de ruta, el interceptor de autenticación y los servicios de crédito y cliente. El workflow de GitHub Actions (`.github/workflows/ci.yml`) corre las pruebas y el build de producción en cada push.

## Estructura del proyecto

```
src/app/
├── core/                       # Servicios transversales
│   ├── auth.service.ts           # Sesión: token, rol, expiración
│   ├── auth.interceptor.ts       # Adjunta el JWT a cada petición
│   ├── guards.ts                 # authGuard, roleGuard, guestOnlyGuard
│   ├── client.service.ts         # Datos del cliente (con caché compartida)
│   ├── webauthn.service.ts       # Alta, baja y login biométrico
│   ├── toast.service.ts          # Notificaciones
│   └── services/                 # Crédito y estado de cuenta
├── shared/toast/               # Componente de notificaciones
├── models/                     # Tipos de crédito y estado de cuenta
├── cliente/                    # Panel de cliente
├── pages/
│   ├── login/  formulario/  password-change/  reset-password/
│   ├── ejecutive/  gerente/
│   ├── credit-offers/  credit-request/  credit-active/  credit-payments/
│   ├── account-statement/  transfer/  transfer-success/
│   ├── home/                   # Redirige al panel según el rol
│   └── forbidden/              # Página 403
├── app.routes.ts               # Rutas y guards
└── main.ts                     # Bootstrap, providers e interceptor

backend/
├── server.js                   # API Express
└── .env.example                # Plantilla de variables de entorno
```

## Próximos pasos

- Endpoints propios para los paneles de ejecutivo y gerente: hoy sus tarjetas muestran datos de ejemplo.
- Pruebas end-to-end de los flujos de login, crédito y transferencia.
- Mover el almacén de *challenges* de WebAuthn de memoria a Redis o a la base de datos, para que funcione con más de una instancia del servidor.
- Desplegar una demo pública con una base de datos de prueba.

## Créditos

Este proyecto nació como trabajo en equipo para la universidad. Yo ([@Juanpineda77](https://github.com/Juanpineda77)) lideré el desarrollo —frontend, backend e integración— junto con dos compañeros que colaboraron en partes puntuales del proyecto original.

## Licencia

MIT — ver [LICENSE](LICENSE).
