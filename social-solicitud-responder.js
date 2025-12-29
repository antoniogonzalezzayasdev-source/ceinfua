// netlify/functions/social-solicitud-responder.js
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
    const { solicitudId, aceptar, usuarioId, usuarioNombre } = JSON.parse(event.body || '{}');

    if (!solicitudId || typeof aceptar !== 'boolean' || !usuarioId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Obtener datos de la solicitud
    const solicitud = await sql`
      SELECT * FROM solicitudes_amistad 
      WHERE id = ${parseInt(solicitudId)} 
        AND para_usuario_id = ${parseInt(usuarioId)} 
        AND estado = 'pendiente'
      LIMIT 1
    `;

    if (solicitud.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Solicitud no encontrada' })
      };
    }

    const sol = solicitud[0];

    if (aceptar) {
      // Actualizar estado de la solicitud
      await sql`
        UPDATE solicitudes_amistad SET estado = 'aceptada' WHERE id = ${parseInt(solicitudId)}
      `;

      // Crear amistad
      await sql`
        INSERT INTO amistades (usuario1_id, usuario2_id)
        VALUES (${sol.de_usuario_id}, ${sol.para_usuario_id})
      `;

      // Notificar al que envió la solicitud
      try {
        await pusher.trigger(`user-${sol.de_usuario_id}`, 'solicitud-aceptada', {
          por_id: usuarioId,
          nombre: usuarioNombre
        });
      } catch (pusherErr) {
        console.error('Error en Pusher:', pusherErr);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Solicitud aceptada' })
      };

    } else {
      // Rechazar - eliminar solicitud
      await sql`
        DELETE FROM solicitudes_amistad WHERE id = ${parseInt(solicitudId)}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Solicitud rechazada' })
      };
    }

  } catch (err) {
    console.error('Error en social-solicitud-responder:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al procesar solicitud' })
    };
  }
};