-- =====================================================================
-- BSPBank — esquema de base de datos
--
-- Este archivo NO crea ni borra la base de datos: espera que ya exista
-- y esté seleccionada. Así el mismo archivo sirve en local y en un
-- proveedor administrado (Railway, Render, Clever Cloud…), donde la
-- base viene creada y el usuario no tiene permiso para DROP/CREATE
-- DATABASE.
--
--   Local:  mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bspbank
--             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
--           mysql -u root -p bspbank < backend/db/schema.sql
--
--   Nube:   mysql -h HOST -u USER -p NOMBRE_DB < backend/db/schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Credenciales de acceso
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id_account             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email                  VARCHAR(150) NOT NULL,
  password_hash          VARCHAR(255) NOT NULL,
  role                   ENUM('cliente','ejecutivo','gerente') NOT NULL,
  estado                 ENUM('activo','bloqueado') NOT NULL DEFAULT 'activo',

  -- Recuperación de contraseña
  reset_token            VARCHAR(255) NULL,
  reset_token_expire     DATETIME NULL,

  -- Inicio de sesión biométrico (WebAuthn)
  webauthn_credential_id TEXT NULL,
  webauthn_public_key    TEXT NULL,
  webauthn_counter       INT NOT NULL DEFAULT 0,
  webauthn_enabled       TINYINT NOT NULL DEFAULT 0,

  creado_en              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- El correo identifica la cuenta por sí solo: el login busca
  -- únicamente por email, y la recuperación de contraseña actualiza
  -- por email. Permitir el mismo correo en varios roles haría que el
  -- login eligiera un rol arbitrario y que restablecer la contraseña
  -- afectara a todas las cuentas que compartieran ese correo.
  UNIQUE KEY uq_account_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2) Perfiles por rol (1:1 con accounts)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gerentes (
  id_gerente      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  account_id      BIGINT UNSIGNED NOT NULL UNIQUE,
  nombre_completo VARCHAR(150) NOT NULL,
  telefono        VARCHAR(30),
  FOREIGN KEY (account_id) REFERENCES accounts(id_account)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ejecutivos (
  id_ejecutivo    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  account_id      BIGINT UNSIGNED NOT NULL UNIQUE,
  id_gerente      BIGINT UNSIGNED,
  nombre_completo VARCHAR(150) NOT NULL,
  telefono        VARCHAR(30),
  FOREIGN KEY (account_id) REFERENCES accounts(id_account)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (id_gerente) REFERENCES gerentes(id_gerente)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  account_id         BIGINT UNSIGNED NOT NULL UNIQUE,
  nombre_completo    VARCHAR(150) NOT NULL,
  ine                VARCHAR(30),
  puntaje_crediticio INT,
  telefono           VARCHAR(30),
  direccion          VARCHAR(200),
  -- Base para la evaluación de crédito: la cuota mensual no puede
  -- superar el 30 % de este ingreso.
  ingreso_mensual    DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  id_gerente         BIGINT UNSIGNED,
  FOREIGN KEY (account_id) REFERENCES accounts(id_account)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (id_gerente) REFERENCES gerentes(id_gerente)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3) Productos y operación
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuentas (
  id_cuenta            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_cliente           BIGINT UNSIGNED NOT NULL,
  tipo                 ENUM('ahorro','cheques','nomina','inversion','otra') NOT NULL DEFAULT 'ahorro',
  estado               ENUM('activa','inactiva','bloqueada','cerrada') NOT NULL DEFAULT 'activa',
  saldo                DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  limite_transferencia DECIMAL(16,2) DEFAULT NULL,
  creado_en            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tarjetas (
  id_tarjeta     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_cuenta      BIGINT UNSIGNED NOT NULL,
  autorizada_por BIGINT UNSIGNED NOT NULL,
  numero_tarjeta CHAR(16) NOT NULL UNIQUE,
  tipo           ENUM('debito','credito','prepago','otro') NOT NULL DEFAULT 'debito',
  estado         ENUM('activa','inactiva','bloqueada','vencida') NOT NULL DEFAULT 'activa',
  limite_credito DECIMAL(16,2) DEFAULT NULL,
  fecha_exp      DATE NOT NULL,
  cvv            CHAR(3) NOT NULL,
  nip_hash       VARCHAR(255),
  creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cuenta) REFERENCES cuentas(id_cuenta)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (autorizada_por) REFERENCES ejecutivos(id_ejecutivo)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transacciones (
  id_transaccion BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_cuenta      BIGINT UNSIGNED NOT NULL,
  tipo           ENUM(
                   'deposito','retiro','compra','pago',
                   'transferencia_salida','transferencia_entrada',
                   'comision','ajuste','credito_interes'
                 ) NOT NULL,
  monto          DECIMAL(16,2) NOT NULL,
  descripcion    VARCHAR(255),
  fecha          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cuenta) REFERENCES cuentas(id_cuenta)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_transaccion_cuenta_fecha (id_cuenta, fecha)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4) Crédito
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes_credito (
  id_solicitud     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_cliente       BIGINT UNSIGNED NOT NULL,
  ingreso_mensual  DECIMAL(16,2) NOT NULL,
  monto_solicitado DECIMAL(16,2) NOT NULL,
  motivo           VARCHAR(255),
  estado           ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  fecha            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS creditos (
  id_credito         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_cliente         BIGINT UNSIGNED NOT NULL,
  limite_credito     DECIMAL(16,2) NOT NULL,
  saldo_usado        DECIMAL(16,2) NOT NULL DEFAULT 0.00,
  interes_mensual    DECIMAL(5,4) NOT NULL DEFAULT 0.03,
  fecha_inicio       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_ultimo_corte DATETIME,
  estado             ENUM('activo','suspendido','cerrado') NOT NULL DEFAULT 'activo',
  FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagos_credito (
  id_pago    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  id_credito BIGINT UNSIGNED NOT NULL,
  monto      DECIMAL(16,2) NOT NULL,
  fecha      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_credito) REFERENCES creditos(id_credito)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
