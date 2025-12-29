// netlify/functions/social-solicitud-enviar.js
const { neon } = require("@netlify/neon");
const Pusher = require("pusher");
const sql = neon();

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
    const { deUserId, paraUserId, deNombre } = JSON.parse(event.body || '{}');

    if (!deUserId || !paraUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Verificar que no exista ya una solicitud
    const existe = await sql`
      SELECT id FROM solicitudes_amistad 
      WHERE (de_usuario_id = ${parseInt(deUserId)} AND para_usuario_id = ${parseInt(paraUserId)}) 
         OR (de_usuario_id = ${parseInt(paraUserId)} AND para_usuario_id = ${parseInt(deUserId)})
      LIMIT 1
    `;

    if (existe.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Ya existe una solicitud pendiente' })
      };
    }

    // Verificar que no sean ya amigos
    const amistad = await sql`
      SELECT id FROM amistades 
      WHERE (usuario1_id = ${parseInt(deUserId)} AND usuario2_id = ${parseInt(paraUserId)}) 
         OR (usuario1_id = ${parseInt(paraUserId)} AND usuario2_id = ${parseInt(deUserId)})
      LIMIT 1
    `;

    if (amistad.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Ya son amigos' })
      };
    }

    // Crear solicitud
    await sql`
      INSERT INTO solicitudes_amistad (de_usuario_id, para_usuario_id, estado)
      VALUES (${parseInt(deUserId)}, ${parseInt(paraUserId)}, 'pendiente')
    `;

    // Notificar al destinatario via Pusher
    try {
      await pusher.trigger(`user-${paraUserId}`, 'nueva-solicitud', {
        de_id: deUserId,
        de_nombre: deNombre
      });
    } catch (pusherErr) {
      console.error('Error en Pusher:', pusherErr);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Solicitud enviada' })
    };

  } catch (err) {
    console.error('Error en social-solicitud-enviar:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al enviar solicitud' })
    };
  }
};