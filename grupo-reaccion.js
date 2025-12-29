// netlify/functions/grupo-reaccion.js
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
    const { grupoId, mensajeId, emoji, deId, deNombre } = JSON.parse(event.body || '{}');

    if (!grupoId || !mensajeId || !emoji || !deId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Emojis permitidos
    const emojisPermitidos = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];
    if (!emojisPermitidos.includes(emoji)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Emoji no permitido' })
      };
    }

    // Enviar reacción a todos via Pusher
    await pusher.trigger(`grupo-${grupoId}`, 'nueva-reaccion', {
      mensaje_id: mensajeId,
      emoji: emoji,
      de_id: deId,
      de_nombre: deNombre,
      timestamp: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Error en grupo-reaccion:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al enviar reacción' })
    };
  }
};