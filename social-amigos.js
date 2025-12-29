// netlify/functions/social-amigos.js
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
    const parsedUserId = parseInt(userId);

    // Obtener amigos donde el usuario es usuario1
    const amigos1 = await sql`
      SELECT 
        a.id,
        a.nombre,
        a.apellido,
        a.correo,
        a.semestre,
        a.estado_social,
        a.ultima_conexion,
        am.creado_en as amigos_desde
      FROM amistades am
      JOIN alumnos a ON a.id = am.usuario2_id
      WHERE am.usuario1_id = ${parsedUserId}
    `;

    // Obtener amigos donde el usuario es usuario2
    const amigos2 = await sql`
      SELECT 
        a.id,
        a.nombre,
        a.apellido,
        a.correo,
        a.semestre,
        a.estado_social,
        a.ultima_conexion,
        am.creado_en as amigos_desde
      FROM amistades am
      JOIN alumnos a ON a.id = am.usuario1_id
      WHERE am.usuario2_id = ${parsedUserId}
    `;

    // Combinar y ordenar por nombre
    const todosAmigos = [...amigos1, ...amigos2].sort((a, b) => 
      a.nombre.localeCompare(b.nombre)
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ amigos: todosAmigos })
    };

  } catch (err) {
    console.error('Error en social-amigos:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al obtener amigos' })
    };
  }
};