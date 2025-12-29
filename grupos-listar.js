// netlify/functions/grupos-listar.js
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
    const grupos = await sql`
      SELECT 
        g.id,
        g.nombre,
        g.descripcion,
        g.materia,
        g.codigo_invitacion,
        g.creado_en,
        gm.rol,
        (SELECT COUNT(*) FROM grupo_miembros WHERE grupo_id = g.id) as total_miembros
      FROM grupos_estudio g
      JOIN grupo_miembros gm ON gm.grupo_id = g.id
      WHERE gm.alumno_id = ${parseInt(userId)}
      ORDER BY g.nombre ASC
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ grupos })
    };

  } catch (err) {
    console.error('Error en grupos-listar:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al cargar grupos' })
    };
  }
};