// netlify/functions/grupo-mensaje.js
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
    const { 
      grupoId, 
      deId, 
      deNombre, 
      mensaje, 
      tipo = 'texto',
      archivo = null 
    } = JSON.parse(event.body || '{}');

    if (!grupoId || !deId || (!mensaje && !archivo)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Verificar que el usuario es miembro del grupo
    const esMiembro = await sql`
      SELECT id FROM grupo_miembros 
      WHERE grupo_id = ${parseInt(grupoId)} AND alumno_id = ${parseInt(deId)}
      LIMIT 1
    `;

    if (esMiembro.length === 0) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'No sos miembro de este grupo' })
      };
    }

    // Preparar datos del mensaje
    const mensajeData = {
      de_id: deId,
      de_nombre: deNombre,
      mensaje: mensaje ? mensaje.substring(0, 1000).trim() : null,
      tipo: tipo,
      archivo: archivo ? {
        nombre: archivo.nombre,
        tipo: archivo.tipo,
        tamaño: archivo.tamaño,
        base64: archivo.base64 || null
      } : null,
      timestamp: new Date().toISOString()
    };

    // Enviar mensaje al canal del grupo via Pusher
    // NO se guarda en base de datos - es efímero
    await pusher.trigger(`grupo-${grupoId}`, 'nuevo-mensaje', mensajeData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Error en grupo-mensaje:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al enviar mensaje' })
    };
  }
};