// server.js (listo — WebAuthn reescrito desde cero)
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const base64url = require('base64url');
require('dotenv').config();

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cambiame';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- WebAuthn config (ajusta ORIGIN y RP_ID para producción) ---
const RP_NAME = 'BSP Bank';
const RP_ID = 'localhost'; // EN PRODUCCIÓN: tu dominio (sin https)
const ORIGIN = 'http://localhost:4200'; // Cambia si tu frontend corre en otro puerto

// challengeStore temporal en memoria: challengeStore[email] = <base64url string>
const challengeStore = {};
// -----------------------------------------------------------------

// Conexión a MySQL
let db;
(async () => {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    console.log('Conectado a MySQL exitosamente!');
  } catch (err) {
    console.error('Error conectando a MySQL:', err.message);
  }
})();

// Middleware para validar JWT (USAR en rutas protegidas)
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // guardamos datos del usuario
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};

const nodeCrypto = require("crypto");

// -----------------------------
// RUTAS NORMALES (login, registro, etc.)
// -----------------------------

// LOGIN (normal)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y password son requeridos' });
    }

    const [rows] = await db.execute(
      'SELECT id_account, email, password_hash, role, estado, webauthn_enabled FROM accounts WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const account = rows[0];

    if (account.estado !== 'activo') {
      return res.status(403).json({ message: 'Cuenta bloqueada o inactiva' });
    }

    // Si el usuario tiene activado WebAuthn, indicamos que debe usar biometría
    if (account.webauthn_enabled === 1) {
      return res.json({
        webauthnRequired: true,
        message: "Este usuario usa login biométrico"
      });
    }

    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const payload = { id: account.id_account, email: account.email, role: account.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    let redirectTo = '/dashboard';
    if (account.role === 'cliente') redirectTo = '/cliente';
    else if (account.role === 'ejecutivo') redirectTo = '/ejecutive';
    else if (account.role === 'gerente') redirectTo = '/gerente';

    return res.json({
      token,
      account: { id: account.id_account, email: account.email, role: account.role, estado: account.estado },
      redirectTo
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// Solicitud de restablecimiento de contraseña
app.post('/password-reset-request', async (req, res) => {
  const { email } = req.body;

  const [rows] = await db.execute('SELECT id_account FROM accounts WHERE email = ?', [email]);

  if (rows.length === 0) {
    return res.status(404).json({ message: 'El correo no está registrado' });
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '15m' });
  const expireTime = new Date(Date.now() + 15 * 60 * 1000);

  await db.execute(
    'UPDATE accounts SET reset_token = ?, reset_token_expire = ? WHERE email = ?',
    [token, expireTime, email]
  );

  const resetLink = `http://localhost:4200/reset-password?token=${token}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  await transporter.sendMail({
    from: `BSPBank <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Restablecer contraseña",
    html: `<p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
      <a href="${resetLink}" target="_blank">${resetLink}</a>
      <p>El enlace expirará en 15 minutos.</p>`
  });

  return res.json({ message: 'Correo de recuperación enviado ✅' });
});

// Restablecer contraseña
app.post('/password-reset', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded.email;

    const [rows] = await db.execute(
      'SELECT id_account, reset_token_expire FROM accounts WHERE email = ? AND reset_token = ?',
      [email, token]
    );

    if (!rows.length) {
      return res.status(400).json({ message: 'Token inválido' });
    }

    const expireDate = new Date(rows[0].reset_token_expire);
    if (expireDate < new Date()) {
      return res.status(400).json({ message: 'Token expirado' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await db.execute(
      'UPDATE accounts SET password_hash = ?, reset_token = NULL, reset_token_expire = NULL WHERE email = ?',
      [hashed, email]
    );

    return res.json({ message: 'Contraseña actualizada correctamente ✅' });

  } catch (err) {
    return res.status(400).json({ message: 'Token inválido o expirado' });
  }
});

// REGISTRO
app.post('/formulario', async (req, res) => {
  const { nombre, email, telefono, fecha, password, ine, rol } = req.body;

  if (!nombre || !email || !telefono || !fecha || !password || !ine || !rol) {
    return res.status(400).json({
      status: 'error',
      message: 'Todos los campos obligatorios deben completarse.'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sqlAccount = `INSERT INTO accounts (email, password_hash, role, estado) VALUES (?, ?, ?, 'activo')`;
    const [resultAccount] = await db.execute(sqlAccount, [email, hashedPassword, rol]);
    const accountId = resultAccount.insertId;

    if (rol === 'cliente') {
      const ingresoAleatorio = (Math.random() * (60000 - 8000) + 8000).toFixed(2);

      const sqlCliente = `INSERT INTO clientes (account_id, nombre_completo, telefono, ine, ingreso_mensual) VALUES (?, ?, ?, ?, ?)`;
      const [resultCliente] = await db.execute(sqlCliente, [accountId, nombre, telefono, ine || null, ingresoAleatorio]);

      const clienteId = resultCliente.insertId;

      const saldoAleatorio = (Math.random() * (50000 - 1000) + 1000).toFixed(2);
      const limiteAleatorio = (Math.random() * (5000 - 500) + 500).toFixed(2);

      const sqlCuentaBancaria = `INSERT INTO cuentas (id_cliente, tipo, estado, saldo, limite_transferencia) VALUES (?, 'ahorro', 'activa', ?, ?)`;
      await db.execute(sqlCuentaBancaria, [clienteId, saldoAleatorio, limiteAleatorio]);


    } else if (rol === 'ejecutivo') {
      const sqlEjecutivo = `INSERT INTO ejecutivos (account_id, nombre_completo, telefono) VALUES (?, ?, ?)`;
      await db.execute(sqlEjecutivo, [accountId, nombre, telefono]);

    } else if (rol === 'gerente') {
      const sqlGerente = `INSERT INTO gerentes (account_id, nombre_completo, telefono) VALUES (?, ?, ?)`;
      await db.execute(sqlGerente, [accountId, nombre, telefono]);
    }

    res.json({ status: 'success', message: 'Registro exitoso, cuenta creada correctamente.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Error al registrar al usuario.' });
  }
});

// Ruta protegida: obtener datos del cliente actual
app.get('/cliente/actual', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        c.nombre_completo AS nombre,
        'Premium' AS nivel,
        cu.saldo,
        a.email,
        a.webauthn_enabled
      FROM clientes c
      LEFT JOIN cuentas cu ON cu.id_cliente = c.id_cliente
      JOIN accounts a ON a.id_account = c.account_id
      WHERE c.account_id = ?
    `, [req.user.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error obteniendo datos del cliente' });
  }
});

// Estado de cuenta (PDF)
app.get('/account-statement/:userId', authMiddleware, async (req, res) => {
  const userId = req.params.userId;

  // Cada usuario solo puede descargar SU estado de cuenta
  if (String(req.user.id) !== String(userId)) {
    return res.status(403).json({ message: 'No autorizado' });
  }

  try {
    if (!db) throw new Error("❌ No hay conexión DB");

    const [rows] = await db.execute(`
      SELECT c.nombre_completo AS nombre, cu.id_cuenta, cu.saldo
      FROM clientes c
      JOIN cuentas cu ON cu.id_cliente = c.id_cliente
      WHERE c.account_id = ?
    `, [userId]);
    
    if (!rows.length) {
      console.warn("⚠ No se encontró cliente con account_id:", userId);
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const cliente = rows[0];

    const [movs] = await db.execute(`
      SELECT fecha, descripcion, monto, tipo
      FROM transacciones
      WHERE id_cuenta = ?
      ORDER BY fecha DESC
      LIMIT 30
    `, [cliente.id_cuenta]);
    
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=estado_cuenta.pdf");

    doc.pipe(res);

    doc.fillColor("#B00020").font("Helvetica-Bold").fontSize(24).text("BSP BANK", { align: "left" });
    doc.moveDown(0.5);
    doc.fillColor("#000000").fontSize(18).text("ESTADO DE CUENTA", { align: "center" });
    doc.moveDown(1.5);
    doc.fillColor("#333");

    doc.fontSize(12)
      .text(`Cliente: ${cliente.nombre}`)
      .text(`Nº Cuenta: ${cliente.id_cuenta}`)
      .text(`Saldo Disponible: $${Number(cliente.saldo).toFixed(2)}`);

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#B00020").lineWidth(1.5).stroke();
    doc.moveDown(1);

    doc.fillColor("#B00020").font("Helvetica-Bold").fontSize(14).text("Movimientos Recientes");
    doc.fillColor("#333").font("Helvetica");
    doc.moveDown(0.8);

    if (!movs.length) {
      doc.fontSize(12).text("No se encontraron transacciones.");
    } else {
      movs.forEach(m => {
        const esIngreso = m.monto > 0;
        const colorMonto = esIngreso ? "#007A33" : "#B00020";

        doc.font("Helvetica-Bold").fontSize(12)
          .fillColor("#111")
          .text(new Date(m.fecha).toLocaleDateString(), { continued: true })
          .fillColor("#555")
          .text(`  |  ${m.tipo.toUpperCase()}`);

        doc.font("Helvetica-Bold")
          .fillColor(colorMonto)
          .text(`${esIngreso ? "+" : "-"}$${Math.abs(m.monto).toFixed(2)}`);

        doc.font("Helvetica")
          .fillColor("#444")
          .fontSize(11)
          .text(`Descripción: ${m.descripcion || "Sin descripción"}`);

        doc.moveDown(0.5);
        doc.strokeColor("#E0E0E0").lineWidth(0.7).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.8);
      });
    }

    doc.end();

  } catch (err) {
    console.error("Error en PDF:", err);
    res.status(500).json({ message: "Error al generar PDF" });
  }
});

// Transferencias entre cuentas
app.post('/transferir', authMiddleware, async (req, res) => {
  const { nombre_beneficiario, clabe_beneficiario, monto, concepto } = req.body;
  const conn = db;

  try {
    const [origenRows] = await conn.execute(`
      SELECT cu.id_cuenta, cu.saldo, c.email
      FROM cuentas cu
      JOIN clientes cli ON cli.id_cliente = cu.id_cliente
      JOIN accounts c ON c.id_account = cli.account_id
      WHERE c.id_account = ?
    `, [req.user.id]);
    
    if (origenRows.length === 0) {
      return res.status(404).json({ message: 'Cuenta origen no encontrada.' });
    }

    const cuentaOrigen = origenRows[0];

    if (monto > cuentaOrigen.saldo) {
      return res.status(400).json({ message: 'Saldo insuficiente.' });
    }

    const [destinoRows] = await conn.execute(
      'SELECT id_cuenta FROM cuentas WHERE id_cuenta = ?',
      [clabe_beneficiario]
    );

    if (destinoRows.length === 0) {
      return res.status(404).json({ message: 'Cuenta destino no encontrada.' });
    }

    const cuentaDestino = destinoRows[0].id_cuenta;

    await conn.beginTransaction();

    await conn.execute('UPDATE cuentas SET saldo = saldo - ? WHERE id_cuenta = ?', [monto, cuentaOrigen.id_cuenta]);
    await conn.execute('UPDATE cuentas SET saldo = saldo + ? WHERE id_cuenta = ?', [monto, cuentaDestino]);

    await conn.execute(`
      INSERT INTO transacciones (id_cuenta, tipo, monto, descripcion, fecha)
      VALUES (?, 'transferencia_salida', ?, ?, NOW())
    `, [cuentaOrigen.id_cuenta, monto * -1, `Transferencia a ${nombre_beneficiario} - ${concepto}`]);
    
    await conn.execute(`
      INSERT INTO transacciones (id_cuenta, tipo, monto, descripcion, fecha)
      VALUES (?, 'transferencia_entrada', ?, ?, NOW())
    `, [cuentaDestino, monto, `Transferencia de ${req.user.email} - ${concepto}`]);
    
    await conn.commit();

    const comprobantesDir = path.join(__dirname, 'comprobantes');
    if (!fs.existsSync(comprobantesDir)) fs.mkdirSync(comprobantesDir);

    const fileName = `comprobante_${Date.now()}.pdf`;
    const filePath = path.join(comprobantesDir, fileName);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(22).fillColor('#d32f2f').text('BSP', { align: 'left' }).moveDown(1);
    doc.moveTo(40, 80).lineTo(550, 80).stroke('#d32f2f');
    doc.moveDown(2);
    doc.fontSize(16).fillColor('#000').text('Comprobante de Transferencia', { align: 'center' }).moveDown(2);

    doc.fontSize(12).fillColor('#333');
    doc.text(`Beneficiario: ${nombre_beneficiario}`);
    doc.text(`Cuenta destino: ${clabe_beneficiario}`);
    doc.text(`Concepto: ${concepto}`);
    doc.text(`Monto: $${monto}`);
    doc.text(`Fecha: ${new Date().toLocaleString()}`);

    doc.end();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `BSP <${process.env.EMAIL_USER}>`,
      to: req.user.email,
      subject: "Comprobante de transferencia",
      html: `<p>Tu transferencia se ha realizado correctamente</p>`,
      attachments: [{ filename: fileName, path: filePath }]
    });

    res.json({ message: "Transferencia realizada con éxito", comprobante: fileName });

  } catch (error) {
    console.error(error);
    try { await conn.rollback(); } catch {}
    res.status(500).json({ message: 'Error al realizar transferencia' });
  }
});

app.get('/comprobantes/:file', authMiddleware, (req, res) => {
  const fileName = req.params.file;

  // Solo nombres generados por el propio servidor: evita path traversal
  if (!/^comprobante_\d+\.pdf$/.test(fileName)) {
    return res.status(400).json({ message: 'Nombre de archivo inválido' });
  }

  const filePath = path.join(__dirname, 'comprobantes', fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Comprobante no encontrado' });
  }

  res.download(filePath);
});

// Créditos
app.post('/credit/request', authMiddleware, async (req, res) => {
  const { ingreso, monto, plazo } = req.body;
  const userId = req.user.id;

  try {
    const [cliente] = await db.query("SELECT id_cliente FROM clientes WHERE account_id = ?", [userId]);

    if (!cliente.length) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const idCliente = cliente[0].id_cliente;

    const [creditosActivos] = await db.query(`
      SELECT id_credito FROM creditos WHERE id_cliente = ? AND estado = 'activo'
    `, [idCliente]);
    
    if (creditosActivos.length > 0) {
      return res.status(400).json({ message: "No es posible solicitar un nuevo crédito teniendo uno activo." });
    }

    const pagoMensual = monto / plazo;
    const maxPagoPermitido = ingreso * 0.30;

    if (pagoMensual > maxPagoPermitido) {
      await db.query(`
        INSERT INTO solicitudes_credito (id_cliente, ingreso_mensual, monto_solicitado, estado)
        VALUES (?,?,?, 'rechazada')
      `, [idCliente, ingreso, monto]);

      return res.status(400).json({ message: "Crédito rechazado: el pago mensual supera el 30% del ingreso." });
    }

    await db.query(`
      INSERT INTO solicitudes_credito (id_cliente, ingreso_mensual, monto_solicitado, estado)
      VALUES (?,?,?, 'aprobada')
    `, [idCliente, ingreso, monto]);

    await db.query(`
      INSERT INTO creditos (id_cliente, limite_credito, saldo_usado, estado)
      VALUES (?, ?, 0, 'activo')
    `, [idCliente, monto]);

    res.json({ message: "Crédito aprobado y activado correctamente" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al procesar la solicitud" });
  }
});

app.get('/credit/requests/history', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT sc.*, c.nombre_completo
      FROM solicitudes_credito sc
      JOIN clientes c ON sc.id_cliente = c.id_cliente
      WHERE c.account_id = ?
      ORDER BY sc.fecha DESC
    `, [req.user.id]);
    res.json({ solicitudes: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener historial" });
  }
});

// Pre-validación de elegibilidad (el frontend la usa antes de abrir la solicitud)
app.get('/credit/check', authMiddleware, async (req, res) => {
  try {
    const [cliente] = await db.query(
      "SELECT id_cliente, ingreso_mensual FROM clientes WHERE account_id = ?",
      [req.user.id]
    );

    if (!cliente.length) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const [creditosActivos] = await db.query(
      "SELECT id_credito FROM creditos WHERE id_cliente = ? AND estado = 'activo'",
      [cliente[0].id_cliente]
    );

    // Máximo financiable: 30% del ingreso mensual durante el plazo más largo (24 meses)
    const ingreso = Number(cliente[0].ingreso_mensual) || 0;
    const maxMontoPermitido = ingreso * 0.30 * 24;

    res.json({
      creditoActivo: creditosActivos.length > 0,
      ingresoMensual: ingreso,
      maxMontoPermitido
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al validar elegibilidad" });
  }
});

app.get('/credit/active', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [cliente] = await db.query("SELECT id_cliente FROM clientes WHERE account_id = ?", [userId]);

    if (!cliente.length) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const idCliente = cliente[0].id_cliente;

    const [credit] = await db.query(
      "SELECT * FROM creditos WHERE id_cliente = ? AND estado = 'activo'",
      [idCliente]
    );

    if (!credit.length) {
      return res.json({ credit: null });
    }

    res.json({ credit: credit[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener crédito activo" });
  }
});

app.post('/credit/pay', authMiddleware, async (req, res) => {
  const { monto } = req.body;

  try {
    const [[credito]] = await db.execute(`
      SELECT cr.id_credito, cr.saldo_usado
      FROM creditos cr
      JOIN clientes c ON cr.id_cliente = c.id_cliente
      WHERE c.account_id = ? AND cr.estado = 'activo'
      LIMIT 1
    `, [req.user.id]);
    
    if (!credito) {
      return res.status(404).json({ message: "No tienes un crédito activo" });
    }

    await db.execute(`INSERT INTO pagos_credito (id_credito, monto) VALUES (?, ?)`, [credito.id_credito, monto]);
    await db.execute(`UPDATE creditos SET saldo_usado = GREATEST(0, saldo_usado - ?) WHERE id_credito = ?`, [monto, credito.id_credito]);
    
    res.json({ message: "Pago aplicado correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al realizar pago" });
  }
});

app.get('/credit/payments/history', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*
      FROM pagos_credito p
      JOIN creditos cr ON p.id_credito = cr.id_credito
      JOIN clientes c ON cr.id_cliente = c.id_cliente
      WHERE c.account_id = ?
      ORDER BY p.fecha DESC
    `, [req.user.id]);
    res.json({ pagos: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener historial de pagos" });
  }
});

app.get('/statement/:userId/:month', authMiddleware, async (req, res) => {
  const userId = req.params.userId;
  const month = req.params.month;

  // Cada usuario solo puede consultar SU estado de cuenta
  if (String(req.user.id) !== String(userId)) {
    return res.status(403).json({ message: 'No autorizado' });
  }

  try {
    const [[cliente]] = await db.execute(`
      SELECT c.nombre_completo AS nombre, cu.id_cuenta, cu.saldo
      FROM clientes c
      JOIN cuentas cu ON cu.id_cliente = c.id_cliente
      WHERE c.account_id = ?
    `, [userId]);
    
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const [movimientos] = await db.execute(`
      SELECT fecha, tipo, monto, descripcion
      FROM transacciones
      WHERE id_cuenta = ? AND DATE_FORMAT(fecha, '%Y-%m') = ?
      ORDER BY fecha DESC
    `, [cliente.id_cuenta, month]);
    
    res.json({ nombre: cliente.nombre, cuenta: cliente.id_cuenta, saldo: cliente.saldo, movimientos });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener estado de cuenta" });
  }
});

// -----------------------------
// WEBAUTHN ENDPOINTS
// -----------------------------

/**
 * /webauthn/register-options
 */
app.post("/webauthn/register-options", authMiddleware, async (req, res) => {
  try {
    // El email sale del JWT: solo el propio usuario autenticado
    // puede registrar una credencial biométrica para su cuenta.
    const email = req.user.email;

    if (!email) {
      return res.status(400).json({ error: "Email requerido" });
    }

    const [rows] = await db.query(
      "SELECT id_account, webauthn_credential_id FROM accounts WHERE email = ? AND role = 'cliente' LIMIT 1",
      [email]
    );


    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const challenge = nodeCrypto.randomBytes(32).toString("base64url");

    const userIdB64 = base64url.encode(String(user.id_account));

    const excludeCredentials = user.webauthn_credential_id ?
      [{ id: String(user.webauthn_credential_id), type: "public-key" }] : [];

    const options = {
      challenge,
      rp: { name: RP_NAME },
      user: { id: userIdB64, name: email, displayName: email },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      timeout: 60000,
      attestation: "none",
      excludeCredentials
    };

    challengeStore[email] = challenge;


    res.json(options);

  } catch (err) {
    console.error("🔥 ERROR INTERNO register-options:", err);
    res.status(500).json({ error: "error generando options", details: err.message });
  }
});

/**
 * /webauthn/register
 */
app.post("/webauthn/register", authMiddleware, async (req, res) => {
  try {
    // El email sale del JWT, no del body: nadie puede registrar
    // una credencial biométrica para la cuenta de otra persona.
    const email = req.user.email;
    const { attestationResponse } = req.body;

    if (!email || !attestationResponse) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // Obtener el challenge esperado
    const expectedChallenge = challengeStore[email];
    if (!expectedChallenge) {
      return res.status(400).json({ error: "Challenge no encontrado o expirado" });
    }


    // Usar verifyRegistrationResponse para extraer la llave pública REAL
    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge: expectedChallenge, // STRING base64url
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID
    });


    if (!verification.verified) {
      return res.status(400).json({ error: "Verificación de registro falló" });
    }

    // La estructura correcta depende de la versión de SimpleWebAuthn
    const registrationInfo = verification.registrationInfo;
    

    // Extraer datos según la estructura real
    const credentialID = registrationInfo.credentialID || registrationInfo.credential?.id;
    const credentialPublicKey = registrationInfo.credentialPublicKey || registrationInfo.credential?.publicKey;
    const counter = registrationInfo.counter !== undefined ? registrationInfo.counter : 0;


    if (!credentialID || !credentialPublicKey) {
      console.error("❌ No se pudieron extraer credenciales");
      return res.status(500).json({ error: "Error extrayendo credenciales del registro" });
    }

    // Convertir a base64url para guardar en DB
    const credentialIdB64 = base64url.encode(credentialID);
    const publicKeyB64 = base64url.encode(credentialPublicKey);


    await db.query(`
      UPDATE accounts 
      SET 
        webauthn_credential_id = ?, 
        webauthn_public_key = ?, 
        webauthn_counter = ?,
        webauthn_enabled = 1
      WHERE email = ? AND role = 'cliente'
    `, [credentialIdB64, publicKeyB64, counter, email]);


    // Limpiar challenge usado
    delete challengeStore[email];

    res.json({ 
      verified: true,
      message: "Registro biométrico exitoso"
    });

  } catch (err) {
    console.error("🔥 ERROR INTERNO register:", err);
    console.error("Stack:", err.stack);
    res.status(500).json({
      error: "error registrando autentificador",
      details: err.message
    });
  }
});

/**
 * /webauthn/disable — desactivar el login biométrico de la propia cuenta
 */
app.post('/webauthn/disable', authMiddleware, async (req, res) => {
  try {
    await db.query(`
      UPDATE accounts
      SET
        webauthn_enabled = 0,
        webauthn_credential_id = NULL,
        webauthn_public_key = NULL,
        webauthn_counter = 0
      WHERE id_account = ?
    `, [req.user.id]);

    res.json({ message: 'Login biométrico desactivado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al desactivar biometría' });
  }
});

/**
 * /webauthn/login-options
 */
app.post('/webauthn/login-options', async (req, res) => {
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email requerido' });
    }

    
    if (!db) {
      return res.status(500).json({ error: 'Database no disponible' });
    }

    const [rows] = await db.execute(
      'SELECT webauthn_credential_id, webauthn_enabled FROM accounts WHERE email = ?',
      [email]
    );


    if (!rows.length) {
      return res.status(404).json({ error: 'usuario no encontrado' });
    }

    const user = rows[0];

    if (!user.webauthn_enabled || user.webauthn_enabled !== 1) {
      return res.status(400).json({ error: 'WebAuthn no habilitado para este usuario' });
    }

    if (!user.webauthn_credential_id) {
      return res.status(400).json({ error: 'No hay credencial WebAuthn registrada' });
    }

    const credIdB64 = user.webauthn_credential_id;

    // Generar challenge como base64url string
    const challenge = nodeCrypto.randomBytes(32).toString("base64url");
    

    // Guardar challenge como STRING base64url (no Buffer)
    challengeStore[email] = challenge;

    const options = {
      challenge: challenge, // Enviar como base64url string
      timeout: 60000,
      rpId: RP_ID,
      allowCredentials: [{
        id: credIdB64,
        type: 'public-key',
        transports: ['internal', 'hybrid']
      }],
      userVerification: 'preferred'
    };


    return res.json(options);
    
  } catch (err) {
    console.error('🔥 ERROR CAPTURADO en login-options:');
    console.error('Tipo:', err.constructor.name);
    console.error('Mensaje:', err.message);
    console.error('Stack:', err.stack);
    
    return res.status(500).json({
      error: 'error generando options',
      details: err.message,
      type: err.constructor.name
    });
  }
});

/**
 * /webauthn/login - ENDPOINT PRINCIPAL
 */
app.post('/webauthn/login', async (req, res) => {
  
  try {
    const { email, credential, assertionResponse } = req.body;
    const authResponse = credential || assertionResponse;
    
    
    if (!authResponse) {
      return res.status(400).json({ message: 'Credential requerida' });
    }
    
    const expectedChallenge = challengeStore[email];
    
    if (!expectedChallenge) {
      return res.status(400).json({ message: 'Challenge no encontrado' });
    }

    // Decodificar clientDataJSON para ver el challenge del navegador
    const clientDataJSON = JSON.parse(
      Buffer.from(authResponse.response.clientDataJSON, 'base64url').toString('utf-8')
    );

    const [rows] = await db.execute(`
      SELECT id_account, email, role, webauthn_credential_id, webauthn_public_key, webauthn_counter 
      FROM accounts WHERE email = ?
    `, [email]);

    if (!rows.length) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = rows[0];

    // Verificar que podemos decodificar la public key
    let publicKeyBuffer;
    try {
      publicKeyBuffer = base64url.toBuffer(user.webauthn_public_key);
    } catch (err) {
      console.error("❌ Error decodificando public key:", err.message);
      return res.status(500).json({ message: 'Error con la llave pública guardada' });
    }


    // Formatear response para SimpleWebAuthn
    const formattedResponse = {
      id: authResponse.id,
      rawId: authResponse.rawId,
      type: authResponse.type,
      response: {
        clientDataJSON: authResponse.response.clientDataJSON,
        authenticatorData: authResponse.response.authenticatorData,
        signature: authResponse.response.signature,
        userHandle: authResponse.response.userHandle
      }
    };


    const verification = await verifyAuthenticationResponse({
      response: formattedResponse,
      expectedChallenge: expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: base64url.toBuffer(user.webauthn_credential_id),
        credentialPublicKey: publicKeyBuffer,
        counter: parseInt(user.webauthn_counter) || 0
      }
    });


    if (!verification.verified) {
      return res.status(400).json({ message: 'Autenticación inválida' });
    }


    await db.execute(
      `UPDATE accounts SET webauthn_counter = ? WHERE id_account = ?`,
      [verification.authenticationInfo.newCounter, user.id_account]
    );

    delete challengeStore[email];

    const token = jwt.sign(
      { id: user.id_account, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    let redirectTo = '/dashboard';
    if (user.role === 'cliente') redirectTo = '/cliente';
    else if (user.role === 'ejecutivo') redirectTo = '/ejecutive';
    else if (user.role === 'gerente') redirectTo = '/gerente';

    return res.json({
      token,
      account: { id: user.id_account, email: user.email, role: user.role },
      redirectTo
    });

  } catch (err) {
    console.error("🔥 ERROR COMPLETO:");
    console.error("Tipo:", err.constructor.name);
    console.error("Mensaje:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ message: 'Error verificando login', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});