// netlify/functions/grupos-crear.js
const { neon } = require("@netlify/neon");
const sql = neon();

// Generar código de invitación único
function generarCodigo(materia) {
  const prefijo = (materia || 'GRUPO').substring(0, 4).toUpperCase().replace(/\s/g, '');
  const aleatorio = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefijo}-${aleatorio}`;
}

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
    const { nombre, descripcion, materia, creadorId } = JSON.parse(event.body || '{}');

    if (!nombre || !creadorId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan campos requeridos' })
      };
    }

    const codigoInvitacion = generarCodigo(materia);

    // Crear grupo
    const grupo = await sql`
      INSERT INTO grupos_estudio (nombre, descripcion, materia, creador_id, codigo_invitacion)
      VALUES (${nombre}, ${descripcion || ''}, ${materia || ''}, ${parseInt(creadorId)}, ${codigoInvitacion})
      RETURNING id, nombre, descripcion, materia, codigo_invitacion, creado_en
    `;

    // Agregar al creador como miembro admin
    await sql`
      INSERT INTO grupo_miembros (grupo_id, alumno_id, rol)
      VALUES (${grupo[0].id}, ${parseInt(creadorId)}, 'admin')
    `;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        success: true, 
        grupo: grupo[0],
        message: 'Grupo creado exitosamente'
      })
    };

  } catch (err) {
    console.error('Error en grupos-crear:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al crear grupo' })
    };
  }
};