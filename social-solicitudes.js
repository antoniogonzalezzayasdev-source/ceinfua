// netlify/functions/social-solicitudes.js
const { neon } = require("@netlify/neon");
const sql = neon();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { userId } = event.queryStringParameters || {};

  if (!userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Falta userId' })
    };
  }

  try {
    // Obtener solicitudes recibidas pendientes
    const solicitudes = await sql`
      SELECT 
        s.id,
        s.de_usuario_id,
        s.estado,
        s.creado_en,
        a.nombre,
        a.apellido,
        a.correo
      FROM solicitudes_amistad s
      JOIN alumnos a ON a.id = s.de_usuario_id
      WHERE s.para_usuario_id = ${parseInt(userId)} AND s.estado = 'pendiente'
      ORDER BY s.creado_en DESC
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ solicitudes })
    };

  } catch (err) {
    console.error('Error en social-solicitudes:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al obtener solicitudes' })
    };
  }
};