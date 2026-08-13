-- =====================================================================
-- BSPBank — datos de ejemplo
--
--   mysql -u root -p bspbank < backend/db/seed.sql
--
-- Crea una cuenta por rol. Las contraseñas están hasheadas con bcrypt
-- (10 rondas), que es lo que compara el backend: guardarlas en texto
-- plano haría que el login fallara siempre.
--
--   cliente@bspbank.mx    Cliente123
--   ejecutivo@bspbank.mx  Ejecutivo123
--   gerente@bspbank.mx    Gerente123
--
-- Son credenciales públicas de demostración: no las reutilices en un
-- entorno real.
--
-- Los perfiles se enlazan con LAST_INSERT_ID() en lugar de con ids
-- escritos a mano, para que cada perfil quede colgado de su propia
-- cuenta aunque el script se cargue sobre una base que ya tenga datos.
-- =====================================================================

START TRANSACTION;

-- ---------------------------------------------------------------------
-- Gerente
-- ---------------------------------------------------------------------
INSERT INTO accounts (email, password_hash, role, estado) VALUES
  ('gerente@bspbank.mx',
   '$2b$10$ZHUsn94alInz8ls/PKmP4uj2JenOhvt6nDbNQUMLYbkqH44.DIx8q',
   'gerente', 'activo');
SET @acc_gerente = LAST_INSERT_ID();

INSERT INTO gerentes (account_id, nombre_completo, telefono) VALUES
  (@acc_gerente, 'Marcos Vidal', '5551000001');
SET @id_gerente = LAST_INSERT_ID();

-- ---------------------------------------------------------------------
-- Ejecutivo
-- ---------------------------------------------------------------------
INSERT INTO accounts (email, password_hash, role, estado) VALUES
  ('ejecutivo@bspbank.mx',
   '$2b$10$8KUF7vih.csKCJwjnyG3ZO5wVWcb4MYencjLU7UapJGmqBOnJjWC.',
   'ejecutivo', 'activo');
SET @acc_ejecutivo = LAST_INSERT_ID();

INSERT INTO ejecutivos (account_id, id_gerente, nombre_completo, telefono) VALUES
  (@acc_ejecutivo, @id_gerente, 'Ana Torres', '5551000002');
SET @id_ejecutivo = LAST_INSERT_ID();

-- ---------------------------------------------------------------------
-- Cliente principal (el de la demo)
-- ---------------------------------------------------------------------
INSERT INTO accounts (email, password_hash, role, estado) VALUES
  ('cliente@bspbank.mx',
   '$2b$10$85ZkhNMBfqAR96M.uAB6d.p8NfT27bUbs2m5sSo7SLcRiyhNImlJu',
   'cliente', 'activo');
SET @acc_cliente = LAST_INSERT_ID();

-- ingreso_mensual define cuánto crédito puede pedir: la cuota mensual
-- no puede superar el 30 % de esta cantidad.
INSERT INTO clientes
  (account_id, nombre_completo, ine, puntaje_crediticio, telefono, direccion, ingreso_mensual, id_gerente)
VALUES
  (@acc_cliente, 'Ana María Reyes', 'INE0000001', 750, '5551000003',
   'Av. Reforma 100, CDMX', 28500.00, @id_gerente);
SET @id_cliente = LAST_INSERT_ID();

INSERT INTO cuentas (id_cliente, tipo, estado, saldo, limite_transferencia) VALUES
  (@id_cliente, 'ahorro', 'activa', 84250.75, 50000.00);
SET @id_cuenta = LAST_INSERT_ID();

-- ---------------------------------------------------------------------
-- Segundo cliente: hace falta una cuenta destino para poder probar
-- una transferencia (el backend valida que exista).
-- ---------------------------------------------------------------------
INSERT INTO accounts (email, password_hash, role, estado) VALUES
  ('cliente2@bspbank.mx',
   '$2b$10$85ZkhNMBfqAR96M.uAB6d.p8NfT27bUbs2m5sSo7SLcRiyhNImlJu',
   'cliente', 'activo');
SET @acc_cliente2 = LAST_INSERT_ID();

INSERT INTO clientes
  (account_id, nombre_completo, ine, puntaje_crediticio, telefono, direccion, ingreso_mensual, id_gerente)
VALUES
  (@acc_cliente2, 'Roberto Salinas', 'INE0000002', 690, '5551000004',
   'Calle Durango 45, CDMX', 19000.00, @id_gerente);
SET @id_cliente2 = LAST_INSERT_ID();

INSERT INTO cuentas (id_cliente, tipo, estado, saldo, limite_transferencia) VALUES
  (@id_cliente2, 'ahorro', 'activa', 12300.00, 20000.00);
SET @id_cuenta2 = LAST_INSERT_ID();

-- ---------------------------------------------------------------------
-- Movimientos del cliente principal
-- Fechas relativas a hoy para que el estado de cuenta del mes actual
-- nunca salga vacío.
-- ---------------------------------------------------------------------
INSERT INTO transacciones (id_cuenta, tipo, monto, descripcion, fecha) VALUES
  (@id_cuenta, 'deposito',              28500.00, 'Depósito de nómina',                    NOW() - INTERVAL 20 DAY),
  (@id_cuenta, 'transferencia_salida',  -1850.00, 'Transferencia a Roberto Salinas - Renta', NOW() - INTERVAL 14 DAY),
  (@id_cuenta, 'compra',                 -640.25, 'Compra en línea',                        NOW() - INTERVAL 9 DAY),
  (@id_cuenta, 'transferencia_entrada',  3200.00, 'Transferencia de Diego Castro - Préstamo', NOW() - INTERVAL 5 DAY),
  (@id_cuenta, 'pago',                  -1200.00, 'Pago de servicios',                      NOW() - INTERVAL 2 DAY);

INSERT INTO transacciones (id_cuenta, tipo, monto, descripcion, fecha) VALUES
  (@id_cuenta2, 'transferencia_entrada', 1850.00, 'Transferencia de Ana María Reyes - Renta', NOW() - INTERVAL 14 DAY);

-- ---------------------------------------------------------------------
-- Tarjetas (requieren un ejecutivo que las autorice)
-- ---------------------------------------------------------------------
INSERT INTO tarjetas
  (id_cuenta, autorizada_por, numero_tarjeta, tipo, estado, limite_credito, fecha_exp, cvv)
VALUES
  (@id_cuenta, @id_ejecutivo, '4111111111112491', 'debito',  'activa', NULL,     '2029-04-30', '123'),
  (@id_cuenta, @id_ejecutivo, '4111111111115679', 'credito', 'activa', 60000.00, '2028-11-30', '456');

-- ---------------------------------------------------------------------
-- Crédito activo del cliente principal, con dos pagos hechos
-- ---------------------------------------------------------------------
INSERT INTO creditos
  (id_cliente, limite_credito, saldo_usado, interes_mensual, estado, fecha_inicio)
VALUES
  (@id_cliente, 60000.00, 42500.00, 0.0180, 'activo', NOW() - INTERVAL 4 MONTH);
SET @id_credito = LAST_INSERT_ID();

INSERT INTO pagos_credito (id_credito, monto, fecha) VALUES
  (@id_credito, 3500.00, NOW() - INTERVAL 2 MONTH),
  (@id_credito, 3500.00, NOW() - INTERVAL 1 MONTH);

INSERT INTO solicitudes_credito
  (id_cliente, ingreso_mensual, monto_solicitado, motivo, estado, fecha)
VALUES
  (@id_cliente, 28500.00, 60000.00, 'Remodelación', 'aprobada', NOW() - INTERVAL 4 MONTH);

COMMIT;
