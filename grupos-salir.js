// netlify/functions/grupos-salir.js
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
    const { grupoId, userId } = JSON.parse(event.body || '{}');

    if (!grupoId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Verificar si es el creador/admin
    const miembro = await sql`
      SELECT gm.rol, g.creador_id 
      FROM grupo_miembros gm
      JOIN grupos_estudio g ON g.id = gm.grupo_id
      WHERE gm.grupo_id = ${parseInt(grupoId)} AND gm.alumno_id = ${parseInt(userId)}
      LIMIT 1
    `;

    if (miembro.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No sos miembro de este grupo' })
      };
    }

    // Si es el creador, eliminar el grupo completo
    if (miembro[0].creador_id === parseInt(userId)) {
      await sql`DELETE FROM grupo_miembros WHERE grupo_id = ${parseInt(grupoId)}`;
      await sql`DELETE FROM grupos_estudio WHERE id = ${parseInt(grupoId)}`;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Grupo eliminado (eras el creador)',
          grupoEliminado: true
        })
      };
    }

    // Si no es el creador, solo salir
    await sql`
      DELETE FROM grupo_miembros 
      WHERE grupo_id = ${parseInt(grupoId)} AND alumno_id = ${parseInt(userId)}
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Saliste del grupo'
      })
    };

  } catch (err) {
    console.error('Error en grupos-salir:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al salir del grupo' })
    };
  }
};