// netlify/functions/social-estado.js
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

  // GET - Obtener estado de un usuario
  if (event.httpMethod === 'GET') {
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Falta userId' })
      };
    }

    try {
      const result = await sql`
        SELECT estado_social, ultima_conexion 
        FROM alumnos 
        WHERE id = ${parseInt(userId)}
        LIMIT 1
      `;

      if (result.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Usuario no encontrado' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result[0])
      };

    } catch (err) {
      console.error('Error en social-estado GET:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error al obtener estado' })
      };
    }
  }

  // POST - Actualizar estado
  if (event.httpMethod === 'POST') {
    try {
      const { userId, estado } = JSON.parse(event.body || '{}');

      if (!userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Falta userId' })
        };
      }

      const estadosValidos = ['disponible', 'ocupado', 'estudiando', 'en_clase', 'desconectado'];
      
      if (estado && !estadosValidos.includes(estado)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Estado no válido' })
        };
      }

      // Si se envía estado, actualizarlo. Siempre actualizar última conexión
      if (estado) {
        await sql`
          UPDATE alumnos 
          SET estado_social = ${estado}, ultima_conexion = NOW()
          WHERE id = ${parseInt(userId)}
        `;
      } else {
        // Solo actualizar última conexión (ping de actividad)
        await sql`
          UPDATE alumnos 
          SET ultima_conexion = NOW()
          WHERE id = ${parseInt(userId)}
        `;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };

    } catch (err) {
      console.error('Error en social-estado POST:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error al actualizar estado' })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};