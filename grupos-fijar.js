// netlify/functions/grupos-fijar.js
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
    const { grupoId, userId, mensaje, accion } = JSON.parse(event.body || '{}');

    if (!grupoId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Verificar que el usuario es admin del grupo
    const esAdmin = await sql`
      SELECT gm.rol FROM grupo_miembros gm
      JOIN grupos_estudio g ON g.id = gm.grupo_id
      WHERE gm.grupo_id = ${parseInt(grupoId)} 
        AND gm.alumno_id = ${parseInt(userId)}
        AND (gm.rol = 'admin' OR g.creador_id = ${parseInt(userId)})
      LIMIT 1
    `;

    if (esAdmin.length === 0) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Solo el admin puede fijar mensajes' })
      };
    }

    // Fijar o desfijar mensaje
    if (accion === 'desfijar') {
      await sql`
        UPDATE grupos_estudio 
        SET mensaje_fijado = NULL, mensaje_fijado_por = NULL, mensaje_fijado_en = NULL
        WHERE id = ${parseInt(grupoId)}
      `;

      // Notificar a todos via Pusher
      await pusher.trigger(`grupo-${grupoId}`, 'mensaje-desfijado', {});

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Mensaje desfijado' })
      };
    }

    // Fijar mensaje
    if (!mensaje) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Falta el mensaje a fijar' })
      };
    }

    await sql`
      UPDATE grupos_estudio 
      SET 
        mensaje_fijado = ${mensaje},
        mensaje_fijado_por = ${parseInt(userId)},
        mensaje_fijado_en = NOW()
      WHERE id = ${parseInt(grupoId)}
    `;

    // Obtener nombre del admin que fijó
    const admin = await sql`
      SELECT nombre, apellido FROM alumnos WHERE id = ${parseInt(userId)} LIMIT 1
    `;

    const fijadoPor = admin.length > 0 ? `${admin[0].nombre} ${admin[0].apellido}` : 'Admin';

    // Notificar a todos via Pusher
    await pusher.trigger(`grupo-${grupoId}`, 'mensaje-fijado', {
      mensaje: mensaje,
      fijado_por: fijadoPor,
      fijado_en: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Mensaje fijado correctamente' })
    };

  } catch (err) {
    console.error('Error en grupos-fijar:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al fijar mensaje' })
    };
  }
};