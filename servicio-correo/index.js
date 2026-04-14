const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const cuenta = await nodemailer.createTestAccount();
  console.log('📧 Cuenta Ethereal creada:', cuenta.user);
  console.log('   Ver correos en: https://ethereal.email');

  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: cuenta.user,
      pass: cuenta.pass,
    },
  });

  return transporter;
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    servicio: 'correo',
    timestamp: new Date().toISOString(),
  });
});

app.post('/enviar', async (req, res) => {
  const { venta_id, cliente_id, total } = req.body;

  if (!venta_id || !cliente_id || total === undefined) {
    return res.status(400).json({
      error: 'Faltan campos obligatorios: venta_id, cliente_id, total',
    });
  }

  try {
    const t = await getTransporter();

    const info = await t.sendMail({
      from: '"ElektraPeru S.A.C." <noreply@elektraperu.com>',
      to: `cliente-${cliente_id}@ejemplo.com`,
      subject: `Confirmación de venta #${venta_id} — ElektraPeru`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="background: #e65c00; padding: 20px;">
            <h2 style="color: white; margin: 0;">⚡ ElektraPeru S.A.C.</h2>
          </div>
          <div style="padding: 24px;">
            <h3 style="color: #333;">Tu venta fue registrada exitosamente</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>N° de venta</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">#${venta_id}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cliente ID</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${cliente_id}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Total</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; color: #e65c00; font-weight: bold;">S/ ${parseFloat(total).toFixed(2)}</td>
              </tr>
            </table>
            <p style="margin-top: 24px; color: #666; font-size: 14px;">
              Gracias por confiar en ElektraPeru. Nos pondremos en contacto contigo pronto.
            </p>
          </div>
        </div>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`📨 Correo enviado para venta #${venta_id}`);
    console.log(`   Preview: ${previewUrl}`);

    return res.status(200).json({
      enviado: true,
      mensaje: 'Correo de confirmación enviado',
      preview_url: previewUrl,
    });

  } catch (err) {
    console.error('Error enviando correo:', err.message);
    return res.status(500).json({
      error: 'Error al enviar correo',
      detalle: err.message,
    });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Servicio Correo corriendo en http://localhost:${PORT}`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   POST http://localhost:${PORT}/enviar`);
});