// netlify/functions/grupo-archivo.js
// Maneja la subida de archivos grandes usando file.io (servicio temporal gratuito)

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
    const { nombre, contenido, tipo } = JSON.parse(event.body || '{}');

    if (!nombre || !contenido) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Faltan parámetros' })
      };
    }

    // Convertir base64 a buffer
    const buffer = Buffer.from(contenido, 'base64');
    
    // Verificar tamaño máximo (5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'El archivo es muy grande (máximo 5MB)' })
      };
    }

    // Subir a file.io (se elimina después de 1 descarga o 14 días)
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: nombre,
      contentType: tipo || 'application/octet-stream'
    });

    const response = await fetch('https://file.io/?expires=1d', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error('Error al subir archivo');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        url: result.link,
        expira: '24 horas o 1 descarga'
      })
    };

  } catch (err) {
    console.error('Error en grupo-archivo:', err);
    
    // Si file.io falla, devolver el archivo en base64 para envío directo
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        usarBase64: true,
        mensaje: 'Archivo se enviará directamente'
      })
    };
  }
};