const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    servicio: 'validacion',
    timestamp: new Date().toISOString(),
  });
});

app.post('/validar', (req, res) => {
  const { cliente_id, vendedor_id, productos, total } = req.body;
  const errores = [];

  if (!cliente_id || typeof cliente_id !== 'number' || cliente_id <= 0) {
    errores.push('cliente_id debe ser un número positivo');
  }

  if (!vendedor_id || typeof vendedor_id !== 'number' || vendedor_id <= 0) {
    errores.push('vendedor_id debe ser un número positivo');
  }

  if (!Array.isArray(productos) || productos.length === 0) {
    errores.push('productos no puede estar vacío');
  } else {
    productos.forEach((p, i) => {
      if (!p.sku || typeof p.sku !== 'string' || p.sku.trim() === '') {
        errores.push(`Producto [${i}]: SKU inválido`);
      }
      if (!p.cantidad || typeof p.cantidad !== 'number' || p.cantidad <= 0) {
        errores.push(`Producto [${i}]: cantidad debe ser mayor a 0`);
      }
      if (!p.precio_unitario || typeof p.precio_unitario !== 'number' || p.precio_unitario <= 0) {
        errores.push(`Producto [${i}]: precio_unitario debe ser mayor a 0`);
      }
    });
  }

  if (total === undefined || typeof total !== 'number' || total <= 0) {
    errores.push('total debe ser un número mayor a 0');
  } else if (Array.isArray(productos) && productos.length > 0 && errores.length === 0) {
    const calculado = productos.reduce(
      (suma, p) => suma + p.cantidad * p.precio_unitario,
      0
    );
    if (Math.abs(calculado - total) > 0.01) {
      errores.push(
        `Total no coincide: enviado S/ ${total.toFixed(2)}, calculado S/ ${calculado.toFixed(2)}`
      );
    }
  }

  if (errores.length > 0) {
    return res.status(400).json({ valido: false, errores });
  }

  return res.status(200).json({ valido: true, mensaje: 'Datos de venta válidos' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servicio Validación corriendo en http://localhost:${PORT}`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   POST http://localhost:${PORT}/validar`);
});