// netlify/functions/posts.js
const { neon } = require("@netlify/neon");

// Crear cliente automático usando NETLIFY_DATABASE_URL
const sql = neon();

exports.handler = async (event, context) => {
  try {
    const method = event.httpMethod;
    const query = event.queryStringParameters || {};
    const id = query.id;

    // ============================
    // OBTENER POSTS (GET)
    // ============================
    if (method === "GET") {
      const tipo = query.tipo || "noticia";

      const rows = await sql`
        SELECT id, titulo, contenido, tipo, creado_en
        FROM posts
        WHERE tipo = ${tipo}
        ORDER BY creado_en DESC
      `;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      };
    }

    // ============================
    // CREAR POST (POST)
    // ============================
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { titulo, contenido, tipo } = body;

      if (!titulo || !contenido || !tipo) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Faltan campos" }),
        };
      }

      await sql`
        INSERT INTO posts (titulo, contenido, tipo)
        VALUES (${titulo}, ${contenido}, ${tipo})
      `;

      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Post creado correctamente" }),
      };
    }

    // ============================
    // ACTUALIZAR POST (PUT)
    // ============================
    if (method === "PUT") {
      if (!id) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Falta ID en la URL" }),
        };
      }

      const body = JSON.parse(event.body || "{}");
      const { titulo, contenido } = body;

      if (!titulo || !contenido) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Faltan datos para actualizar" }),
        };
      }

      const result = await sql`
        UPDATE posts
        SET titulo = ${titulo}, contenido = ${contenido}
        WHERE id = ${id}
        RETURNING *
      `;

      if (result.length === 0) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Post no encontrado" }),
        };
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Post actualizado" }),
      };
    }

    // ============================
    // ELIMINAR POST (DELETE)
    // ============================
    if (method === "DELETE") {
      if (!id) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Falta ID en la URL" }),
        };
      }

      const result = await sql`
        DELETE FROM posts
        WHERE id = ${id}
        RETURNING id
      `;

      if (result.length === 0) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Post no encontrado" }),
        };
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Post eliminado" }),
      };
    }

    // ============================
    // MÉTODO NO PERMITIDO
    // ============================
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Método no permitido" }),
    };

  } catch (err) {
    console.error("Error en función posts:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Error en el servidor" }),
    };
  }
};
