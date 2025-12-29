// netlify/functions/social-buscar.js
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

  const { q, userId } = event.queryStringParameters || {};

  if (!q || !userId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Faltan parámetros' })
    };
  }

  try {
    // Buscar usuarios por correo (excluir al usuario actual)
    const usuarios = await sql`
      SELECT 
        a.id, 
        a.nombre, 
        a.apellido, 
        a.correo, 
        a.semestre
      FROM alumnos a
      WHERE a.correo ILIKE ${'%' + q + '%'} 
        AND a.id != ${parseInt(userId)}
        AND a.estado = 'aprobado'
      LIMIT 10
    `;

    // Para cada usuario, verificar el estado de la relación
    const usuariosConEstado = await Promise.all(usuarios.map(async (u) => {
      // Verificar si ya son amigos
      const amistad = await sql`
        SELECT id FROM amistades 
        WHERE (usuario1_id = ${parseInt(userId)} AND usuario2_id = ${u.id}) 
           OR (usuario2_id = ${parseInt(userId)} AND usuario1_id = ${u.id})
        LIMIT 1
      `;

      if (amistad.length > 0) {
        return { ...u, estado: 'amigos', solicitud_id: null };
      }

      // Verificar si hay solicitud enviada por el usuario actual
      const solicitudEnviada = await sql`
        SELECT id FROM solicitudes_amistad 
        WHERE de_usuario_id = ${parseInt(userId)} AND para_usuario_id = ${u.id} AND estado = 'pendiente'
        LIMIT 1
      `;

      if (solicitudEnviada.length > 0) {
        return { ...u, estado: 'pendiente_enviada', solicitud_id: null };
      }

      // Verificar si hay solicitud recibida
      const solicitudRecibida = await sql`
        SELECT id FROM solicitudes_amistad 
        WHERE de_usuario_id = ${u.id} AND para_usuario_id = ${parseInt(userId)} AND estado = 'pendiente'
        LIMIT 1
      `;

      if (solicitudRecibida.length > 0) {
        return { ...u, estado: 'pendiente_recibida', solicitud_id: solicitudRecibida[0].id };
      }

      return { ...u, estado: 'ninguno', solicitud_id: null };
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ usuarios: usuariosConEstado })
    };

  } catch (err) {
    console.error('Error en social-buscar:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error al buscar usuarios' })
    };
  }
};