// netlify/functions/grupos-detalle.js
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

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { grupoId, userId } = event.queryStringParameters || {};

  if (!grupoId || !userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Faltan parámetros grupoId y userId' })
    };
  }

  try {
    const grupoIdInt = parseInt(grupoId);
    const userIdInt = parseInt(userId);

    // Verificar que el usuario es miembro
    const esMiembro = await sql`
      SELECT id, rol FROM grupo_miembros 
      WHERE grupo_id = ${grupoIdInt} AND alumno_id = ${userIdInt}
      LIMIT 1
    `;

    if (esMiembro.length === 0) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'No sos miembro de este grupo' })
      };
    }

    const esAdmin = esMiembro[0].rol === 'admin';

    // Obtener datos del grupo incluyendo mensaje fijado
    const grupoResult = await sql`
      SELECT 
        g.id,
        g.nombre,
        g.descripcion,
        g.materia,
        g.codigo_invitacion,
        g.creador_id,
        g.creado_en,
        g.mensaje_fijado,
        g.mensaje_fijado_por,
        g.mensaje_fijado_en,
        a.nombre as creador_nombre,
        a.apellido as creador_apellido,
        af.nombre as fijado_por_nombre,
        af.apellido as fijado_por_apellido
      FROM grupos_estudio g
      JOIN alumnos a ON a.id = g.creador_id
      LEFT JOIN alumnos af ON af.id = g.mensaje_fijado_por
      WHERE g.id = ${grupoIdInt}
      LIMIT 1
    `;

    if (grupoResult.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Grupo no encontrado' })
      };
    }

    const grupo = grupoResult[0];

    // Obtener miembros del grupo
    const miembros = await sql`
      SELECT 
        a.id,
        a.nombre,
        a.apellido,
        a.correo,
        a.semestre,
        a.estado_social,
        a.ultima_conexion,
        gm.rol,
        gm.unido_en
      FROM grupo_miembros gm
      JOIN alumnos a ON a.id = gm.alumno_id
      WHERE gm.grupo_id = ${grupoIdInt}
      ORDER BY gm.rol DESC, a.nombre ASC
    `;

    // Devolver estructura con mensaje fijado
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        grupo: {
          ...grupo,
          es_admin: esAdmin || grupo.creador_id === userIdInt
        },
        miembros: miembros,
        mensaje_fijado: grupo.mensaje_fijado ? {
          texto: grupo.mensaje_fijado,
          fijado_por: grupo.fijado_por_nombre ? `${grupo.fijado_por_nombre} ${grupo.fijado_por_apellido}` : 'Admin',
          fijado_en: grupo.mensaje_fijado_en
        } : null
      })
    };

  } catch (err) {
    console.error('Error en grupos-detalle:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al obtener grupo: ' + err.message })
    };
  }
};