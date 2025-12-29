// netlify/functions/grupos-unirse.js
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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { codigo, userId } = JSON.parse(event.body || '{}');

    if (!codigo || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Buscar grupo por código
    const grupo = await sql`
      SELECT id, nombre FROM grupos_estudio 
      WHERE codigo_invitacion = ${codigo.toUpperCase().trim()}
      LIMIT 1
    `;

    if (grupo.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Código de invitación inválido' })
      };
    }

    // Verificar si ya es miembro
    const yaMiembro = await sql`
      SELECT id FROM grupo_miembros 
      WHERE grupo_id = ${grupo[0].id} AND alumno_id = ${parseInt(userId)}
      LIMIT 1
    `;

    if (yaMiembro.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Ya sos miembro de este grupo' })
      };
    }

    // Unirse al grupo
    await sql`
      INSERT INTO grupo_miembros (grupo_id, alumno_id, rol)
      VALUES (${grupo[0].id}, ${parseInt(userId)}, 'miembro')
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        grupo: grupo[0],
        message: `Te uniste a "${grupo[0].nombre}"`
      })
    };

  } catch (err) {
    console.error('Error en grupos-unirse:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al unirse al grupo' })
    };
  }
};