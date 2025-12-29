// netlify/functions/social-mensaje.js
const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { deId, deNombre, paraId, mensaje } = JSON.parse(event.body || '{}');

    if (!deId || !paraId || !mensaje) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Sanitizar mensaje (máximo 500 caracteres)
    const mensajeLimpio = mensaje.substring(0, 500).trim();

    if (!mensajeLimpio) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Mensaje vacío' })
      };
    }

    // Enviar mensaje al destinatario via Pusher
    // El mensaje NO se guarda en ninguna base de datos - es efímero
    await pusher.trigger(`user-${paraId}`, 'nuevo-mensaje', {
      de_id: deId,
      de_nombre: deNombre,
      mensaje: mensajeLimpio,
      timestamp: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Error en social-mensaje:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al enviar mensaje' })
    };
  }
};