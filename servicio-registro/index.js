const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const mysql   = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',       
  password: process.env.DB_PASSWORD || '12345',            
  database: process.env.DB_NAME     || 'elektraperu',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool;
async function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    try {
      const conn = await pool.getConnection();
      console.log('✅ Conectado a MySQL correctamente');
      conn.release();
    } catch (err) {
      console.error('❌ Error conectando a MySQL:', err.message);
      console.error('   Verifica que MySQL esté corriendo y que las credenciales en dbConfig sean correctas');
    }
  }
  return pool;
}

const VALIDACION_URL = process.env.VALIDACION_URL || 'http://localhost:3001';
const CORREO_URL     = process.env.CORREO_URL     || 'http://localhost:3002';

app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    const db = await getPool();
    await db.execute('SELECT 1');
  } catch {
    dbStatus = 'error';
  }

  res.json({
    status: 'ok',
    servicio: 'registro',
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

app.get('/ventas', async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      'SELECT * FROM ventas ORDER BY fecha DESC LIMIT 20'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error consultando ventas', detalle: err.message });
  }
});

app.post('/ventas', async (req, res) => {
  const { cliente_id, vendedor_id, productos, total } = req.body;

  console.log(`\n📋 Nueva solicitud de venta — cliente: ${cliente_id}`);
  console.log(`   Llamando al servicio de validación en ${VALIDACION_URL}...`);

  try {
    const respValidacion = await axios.post(`${VALIDACION_URL}/validar`, {
      cliente_id,
      vendedor_id,
      productos,
      total,
    });

    if (!respValidacion.data.valido) {
      console.log('❌ Validación fallida:', respValidacion.data.errores);
      return res.status(400).json({
        error: 'Validación fallida',
        detalle: respValidacion.data.errores,
      });
    }

    console.log('✅ Validación exitosa');

  } catch (err) {
    console.error('❌ Error al contactar servicio de validación:', err.message);
    return res.status(500).json({
      error: 'No se pudo contactar el servicio de validación',
      detalle: err.message,
    });
  }

  let ventaId;
  try {
    const db = await getPool();

    const [result] = await db.execute(
      'INSERT INTO ventas (cliente_id, vendedor_id, total, estado) VALUES (?, ?, ?, ?)',
      [cliente_id, vendedor_id, total, 'REGISTRADA']
    );
    ventaId = result.insertId;
    console.log(`✅ Venta #${ventaId} guardada en MySQL`);

    for (const p of productos) {
      await db.execute(
        'INSERT INTO detalle_venta (venta_id, sku, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [ventaId, p.sku, p.cantidad, p.precio_unitario]
      );
    }
    console.log(`✅ ${productos.length} producto(s) guardados en detalle_venta`);

  } catch (err) {
    console.error('❌ Error guardando en MySQL:', err.message);
    return res.status(500).json({
      error: 'Error al guardar la venta en la base de datos',
      detalle: err.message,
    });
  }

  console.log(`   Notificando al servicio de correo en ${CORREO_URL}...`);
  axios
    .post(`${CORREO_URL}/enviar`, { venta_id: ventaId, cliente_id, total })
    .then(r => console.log(`✅ Correo enviado. Preview: ${r.data.preview_url}`))
    .catch(err => console.warn('⚠️  No se pudo enviar el correo:', err.message));

  return res.status(201).json({
    mensaje: 'Venta registrada exitosamente',
    venta_id: ventaId,
    total,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Servicio Registro corriendo en http://localhost:${PORT}`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   GET  http://localhost:${PORT}/ventas`);
  console.log(`   POST http://localhost:${PORT}/ventas`);
  console.log(`\n   Validación → ${VALIDACION_URL}`);
  console.log(`   Correo     → ${CORREO_URL}`);

  await getPool();
});