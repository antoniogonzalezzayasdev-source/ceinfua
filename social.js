// js/social.js - Sistema Social CEINFUA v2
// Con localStorage para conservar mensajes

// ===========================
// CONFIGURACIÓN
// ===========================
const PUSHER_KEY = '32b8754ae93021dc8617';
const PUSHER_CLUSTER = 'sa1';
const MAX_MENSAJES_LOCAL = 100;

const ESTADOS = {
  disponible: { emoji: '🟢', texto: 'Disponible', color: '#10b981' },
  ocupado: { emoji: '🟡', texto: 'Ocupado', color: '#f59e0b' },
  estudiando: { emoji: '📚', texto: 'Estudiando', color: '#8b5cf6' },
  en_clase: { emoji: '🎓', texto: 'En clase', color: '#3b82f6' },
  desconectado: { emoji: '🔴', texto: 'Desconectado', color: '#6b7280' }
};

// ===========================
// ESTADO GLOBAL
// ===========================
let currentUser = null;
let currentChat = null;
let pusher = null;
let privateChannel = null;
let typingTimeout = null;
let activityInterval = null;
let mensajesPrivados = {}; // {odrigoId: [mensajes]}

// ===========================
// INICIALIZACIÓN
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  currentUser = JSON.parse(localStorage.getItem('alumnoActual'));
  
  if (!currentUser || !currentUser.id) {
    alert('Debés iniciar sesión para acceder al área social');
    window.location.href = 'alumno-login.html';
    return;
  }

  // Cargar mensajes del localStorage
  cargarMensajesLocales();

  // Inicializar Pusher
  initPusher();
  
  // Cargar datos
  cargarSolicitudes();
  cargarAmigos();
  
  // Estado
  actualizarEstado('disponible');
  iniciarPingActividad();
  
  // Event listeners
  setupEventListeners();
  cargarEstadoGuardado();
});

// ===========================
// LOCAL STORAGE - MENSAJES
// ===========================
function cargarMensajesLocales() {
  try {
    const stored = localStorage.getItem('ceinfua_mensajes_privados');
    if (stored) {
      mensajesPrivados = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error cargando mensajes:', e);
    mensajesPrivados = {};
  }
}

function guardarMensajesLocales() {
  try {
    localStorage.setItem('ceinfua_mensajes_privados', JSON.stringify(mensajesPrivados));
  } catch (e) {
    console.error('Error guardando mensajes:', e);
    limpiarMensajesAntiguos();
  }
}

function agregarMensajeLocal(amigoId, mensaje) {
  const odrigoId = String(amigoId);
  if (!mensajesPrivados[amigoId]) {
    mensajesPrivados[amigoId] = [];
  }
  
  mensaje.id = mensaje.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  mensaje.timestamp = mensaje.timestamp || new Date().toISOString();
  
  mensajesPrivados[amigoId].push(mensaje);
  
  // Limitar cantidad
  if (mensajesPrivados[amigoId].length > MAX_MENSAJES_LOCAL) {
    mensajesPrivados[amigoId] = mensajesPrivados[amigoId].slice(-MAX_MENSAJES_LOCAL);
  }
  
  guardarMensajesLocales();
  return mensaje.id;
}

function obtenerMensajesLocales(amigoId) {
  return mensajesPrivados[String(amigoId)] || [];
}

function limpiarMensajesAntiguos() {
  for (const odrigoId in mensajesPrivados) {
    if (mensajesPrivados[amigoId].length > 50) {
      mensajesPrivados[amigoId] = mensajesPrivados[amigoId].slice(-50);
    }
  }
  guardarMensajesLocales();
}

// ===========================
// PUSHER
// ===========================
function initPusher() {
  pusher = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    forceTLS: true
  });

  privateChannel = pusher.subscribe(`user-${currentUser.id}`);
  
  // Nuevo mensaje
  privateChannel.bind('nuevo-mensaje', (data) => {
    // Guardar en localStorage
    agregarMensajeLocal(data.de_id, {
      de_id: data.de_id,
      para_id: currentUser.id,
      mensaje: data.mensaje,
      tipo: 'received',
      timestamp: data.timestamp
    });

    if (currentChat && data.de_id === currentChat.id) {
      renderizarMensaje(data.mensaje, 'received', data.timestamp);
    } else {
      showToast(`💬 Nuevo mensaje de ${data.de_nombre}`, 'success');
      // Actualizar badge de no leídos
      actualizarBadgeNoLeidos(data.de_id);
    }
    playNotificationSound();
  });

  // Typing
  privateChannel.bind('typing', (data) => {
    if (currentChat && data.de_id === currentChat.id) {
      mostrarTyping(data.de_nombre);
    }
  });

  // Solicitudes
  privateChannel.bind('nueva-solicitud', (data) => {
    showToast(`📩 ${data.de_nombre} te envió solicitud de amistad`, 'success');
    cargarSolicitudes();
  });

  privateChannel.bind('solicitud-aceptada', (data) => {
    showToast(`🎉 ${data.nombre} aceptó tu solicitud`, 'success');
    cargarAmigos();
  });

  console.log('Pusher inicializado para user-' + currentUser.id);
}

// ===========================
// ESTADO Y ÚLTIMA CONEXIÓN
// ===========================
async function actualizarEstado(estado) {
  try {
    await fetch('/.netlify/functions/social-estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, estado })
    });
    localStorage.setItem('ceinfua_estado_social', estado);
    actualizarSelectorEstado(estado);
  } catch (err) {
    console.error('Error actualizando estado:', err);
  }
}

function cargarEstadoGuardado() {
  const estado = localStorage.getItem('ceinfua_estado_social') || 'disponible';
  actualizarSelectorEstado(estado);
}

function actualizarSelectorEstado(estado) {
  const btn = document.getElementById('estadoBtn');
  const info = ESTADOS[estado] || ESTADOS.disponible;
  if (btn) {
    btn.innerHTML = `${info.emoji} ${info.texto} <span class="dropdown-arrow">▼</span>`;
  }
}

function iniciarPingActividad() {
  activityInterval = setInterval(() => {
    fetch('/.netlify/functions/social-estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    }).catch(() => {});
  }, 120000);
}

function formatearUltimaConexion(fecha) {
  if (!fecha) return 'Nunca';
  const diffMin = Math.floor((new Date() - new Date(fecha)) / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `Hace ${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 7) return `Hace ${diffDias} días`;
  return new Date(fecha).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' });
}

function estaEnLinea(ultima) {
  if (!ultima) return false;
  return (new Date() - new Date(ultima)) / 60000 < 5;
}

// ===========================
// EVENT LISTENERS
// ===========================
function setupEventListeners() {
  // Buscar
  document.getElementById('searchBtn')?.addEventListener('click', buscarUsuarios);
  document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') buscarUsuarios();
  });

  // Mensaje
  document.getElementById('sendBtn')?.addEventListener('click', enviarMensaje);
  document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarMensaje();
  });
  document.getElementById('messageInput')?.addEventListener('input', () => {
    if (currentChat) enviarTyping();
  });

  // Estado
  const estadoBtn = document.getElementById('estadoBtn');
  const estadoDropdown = document.getElementById('estadoDropdown');
  
  estadoBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    estadoDropdown.classList.toggle('show');
  });
  
  document.addEventListener('click', () => {
    estadoDropdown?.classList.remove('show');
  });
  
  estadoDropdown?.querySelectorAll('.estado-option').forEach(opt => {
    opt.addEventListener('click', () => {
      actualizarEstado(opt.dataset.estado);
      estadoDropdown.classList.remove('show');
      showToast(`Estado: ${ESTADOS[opt.dataset.estado].texto}`, 'success');
    });
  });

  // Emoji picker
  document.getElementById('btnEmoji')?.addEventListener('click', toggleEmojiPicker);
  
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('emojiPicker');
    const btn = document.getElementById('btnEmoji');
    if (picker && !picker.contains(e.target) && e.target !== btn) {
      picker.classList.remove('show');
    }
  });

  // Logout
  document.getElementById('nav-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSesion();
  });
}

// ===========================
// BUSCAR USUARIOS
// ===========================
async function buscarUsuarios() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) {
    showToast('Ingresá un correo para buscar', 'error');
    return;
  }

  const results = document.getElementById('searchResults');
  results.innerHTML = '<div class="loader"></div>';

  try {
    const resp = await fetch(`/.netlify/functions/social-buscar?q=${encodeURIComponent(query)}&userId=${currentUser.id}`);
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error);

    if (data.usuarios.length === 0) {
      results.innerHTML = '<p class="empty-state">No se encontraron usuarios</p>';
      return;
    }

    results.innerHTML = data.usuarios.map(u => `
      <div class="user-item">
        <div class="user-avatar">${getInitials(u.nombre, u.apellido)}</div>
        <div class="user-info">
          <strong>${u.nombre} ${u.apellido}</strong>
          <small>${u.correo}</small>
        </div>
        <div class="user-actions">
          ${u.estado === 'ninguno' ? `<button class="btn-add" onclick="enviarSolicitud(${u.id})">Agregar</button>` : ''}
          ${u.estado === 'pendiente_enviada' ? `<small class="text-muted">Pendiente</small>` : ''}
          ${u.estado === 'pendiente_recibida' ? `<button class="btn-accept" onclick="aceptarSolicitud(${u.solicitud_id})">Aceptar</button>` : ''}
          ${u.estado === 'amigos' ? `<button class="btn-chat" onclick="abrirChat(${u.id}, '${escapeHtml(u.nombre)}', '${escapeHtml(u.apellido)}', '${escapeHtml(u.correo)}')">Chat</button>` : ''}
        </div>
      </div>
    `).join('');

  } catch (err) {
    results.innerHTML = '<p class="empty-state">Error al buscar</p>';
    showToast(err.message, 'error');
  }
}

// ===========================
// SOLICITUDES
// ===========================
async function cargarSolicitudes() {
  const list = document.getElementById('solicitudesList');
  const badge = document.getElementById('solicitudesCount');

  try {
    const resp = await fetch(`/.netlify/functions/social-solicitudes?userId=${currentUser.id}`);
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error);

    const pendientes = data.solicitudes.filter(s => s.estado === 'pendiente');

    if (pendientes.length === 0) {
      badge.style.display = 'none';
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><p>Sin solicitudes</p></div>`;
      return;
    }

    badge.textContent = pendientes.length;
    badge.style.display = 'inline';

    list.innerHTML = pendientes.map(s => `
      <div class="user-item">
        <div class="user-avatar">${getInitials(s.nombre, s.apellido)}</div>
        <div class="user-info">
          <strong>${s.nombre} ${s.apellido}</strong>
          <small>${s.correo}</small>
        </div>
        <div class="user-actions">
          <button class="btn-accept" onclick="aceptarSolicitud(${s.id})">✓</button>
          <button class="btn-reject" onclick="rechazarSolicitud(${s.id})">✕</button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error cargando solicitudes:', err);
  }
}

async function enviarSolicitud(paraUserId) {
  try {
    const resp = await fetch('/.netlify/functions/social-solicitud-enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deUserId: currentUser.id,
        paraUserId,
        deNombre: `${currentUser.nombre} ${currentUser.apellido}`
      })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

    showToast('✅ Solicitud enviada', 'success');
    buscarUsuarios();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function aceptarSolicitud(solicitudId) {
  try {
    const resp = await fetch('/.netlify/functions/social-solicitud-responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        solicitudId,
        aceptar: true,
        usuarioId: currentUser.id,
        usuarioNombre: `${currentUser.nombre} ${currentUser.apellido}`
      })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

    showToast('🎉 ¡Ahora son amigos!', 'success');
    cargarSolicitudes();
    cargarAmigos();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function rechazarSolicitud(solicitudId) {
  try {
    const resp = await fetch('/.netlify/functions/social-solicitud-responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId, aceptar: false, usuarioId: currentUser.id })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

    showToast('Solicitud rechazada', 'success');
    cargarSolicitudes();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===========================
// AMIGOS
// ===========================
async function cargarAmigos() {
  const list = document.getElementById('amigosList');

  try {
    const resp = await fetch(`/.netlify/functions/social-amigos?userId=${currentUser.id}`);
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error);

    if (data.amigos.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👋</div><p>Sin amigos aún</p></div>`;
      return;
    }

    list.innerHTML = data.amigos.map(a => {
      const estadoInfo = ESTADOS[a.estado_social] || ESTADOS.desconectado;
      const enLinea = estaEnLinea(a.ultima_conexion);
      const noLeidos = contarNoLeidos(a.id);
      
      return `
        <div class="user-item ${currentChat?.id === a.id ? 'active' : ''}" 
             onclick="abrirChat(${a.id}, '${escapeHtml(a.nombre)}', '${escapeHtml(a.apellido)}', '${escapeHtml(a.correo)}', '${a.estado_social || 'desconectado'}', '${a.ultima_conexion || ''}')">
          <div class="user-avatar">
            ${getInitials(a.nombre, a.apellido)}
            <span class="status-dot" style="background: ${enLinea ? estadoInfo.color : '#6b7280'}"></span>
          </div>
          <div class="user-info">
            <strong>${a.nombre} ${a.apellido}</strong>
            <small>${enLinea ? estadoInfo.emoji + ' ' + estadoInfo.texto : '🕐 ' + formatearUltimaConexion(a.ultima_conexion)}</small>
          </div>
          ${noLeidos > 0 ? `<span class="badge-unread">${noLeidos}</span>` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error cargando amigos:', err);
  }
}

function contarNoLeidos(amigoId) {
  // Por ahora retornamos 0, se puede implementar con localStorage
  return 0;
}

function actualizarBadgeNoLeidos(amigoId) {
  // Refrescar lista de amigos para mostrar badge
  cargarAmigos();
}

// ===========================
// CHAT
// ===========================
function abrirChat(userId, nombre, apellido, correo, estado = 'disponible', ultimaConexion = '') {
  currentChat = { id: userId, nombre, apellido, correo, estado, ultimaConexion };

  // Mostrar chat
  document.getElementById('chatEmpty').style.display = 'none';
  document.getElementById('chatActive').style.display = 'flex';

  document.getElementById('chatAvatar').textContent = getInitials(nombre, apellido);
  document.getElementById('chatNombre').textContent = `${nombre} ${apellido}`;
  
  const estadoInfo = ESTADOS[estado] || ESTADOS.desconectado;
  const enLinea = estaEnLinea(ultimaConexion);
  document.getElementById('chatCorreo').innerHTML = enLinea 
    ? `${estadoInfo.emoji} ${estadoInfo.texto}`
    : `🕐 ${formatearUltimaConexion(ultimaConexion)}`;
  
  document.getElementById('chatStatus').style.background = enLinea ? estadoInfo.color : '#6b7280';

  // Cargar mensajes del localStorage
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  
  const mensajes = obtenerMensajesLocales(userId);
  if (mensajes.length > 0) {
    mensajes.forEach(msg => {
      const tipo = msg.tipo || (msg.de_id === currentUser.id ? 'sent' : 'received');
      renderizarMensaje(msg.mensaje, tipo, msg.timestamp, false);
    });
  } else {
    container.innerHTML = `
      <div class="mensaje-sistema">
        <span>💬 Iniciá la conversación con ${nombre}</span>
        <small>Los mensajes se guardan en tu navegador</small>
      </div>
    `;
  }

  container.scrollTop = container.scrollHeight;
  cargarAmigos();
  document.getElementById('messageInput').focus();
}

async function enviarMensaje() {
  const input = document.getElementById('messageInput');
  const mensaje = input.value.trim();

  if (!mensaje || !currentChat) return;

  input.value = '';

  // Guardar localmente
  agregarMensajeLocal(currentChat.id, {
    de_id: currentUser.id,
    para_id: currentChat.id,
    mensaje: mensaje,
    tipo: 'sent'
  });

  // Renderizar
  renderizarMensaje(mensaje, 'sent');

  // Enviar por Pusher
  try {
    await fetch('/.netlify/functions/social-mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deId: currentUser.id,
        deNombre: `${currentUser.nombre} ${currentUser.apellido}`,
        paraId: currentChat.id,
        mensaje
      })
    });
  } catch (err) {
    console.error('Error enviando mensaje:', err);
    showToast('Error al enviar', 'error');
  }
}

function renderizarMensaje(texto, tipo, timestamp = null, scroll = true) {
  const container = document.getElementById('chatMessages');
  const time = timestamp ? new Date(timestamp) : new Date();
  const timeStr = time.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${tipo}`;
  msgDiv.innerHTML = `
    <div class="message-text">${escapeHtml(texto)}</div>
    <div class="message-time">${timeStr}</div>
  `;

  container.appendChild(msgDiv);
  
  if (scroll) {
    container.scrollTop = container.scrollHeight;
  }
}

function enviarTyping() {
  if (typingTimeout) clearTimeout(typingTimeout);

  fetch('/.netlify/functions/social-typing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deId: currentUser.id,
      deNombre: currentUser.nombre,
      paraId: currentChat.id
    })
  }).catch(() => {});

  typingTimeout = setTimeout(() => typingTimeout = null, 2000);
}

function mostrarTyping(nombre) {
  const indicator = document.getElementById('typingIndicator');
  document.getElementById('typingText').textContent = `${nombre} está escribiendo...`;
  indicator.style.display = 'flex';
  setTimeout(() => indicator.style.display = 'none', 3000);
}

// ===========================
// EMOJI PICKER
// ===========================
function toggleEmojiPicker() {
  document.getElementById('emojiPicker')?.classList.toggle('show');
}

function insertarEmoji(emoji) {
  const input = document.getElementById('messageInput');
  input.value += emoji;
  input.focus();
}

// ===========================
// UTILIDADES
// ===========================
function getInitials(nombre, apellido) {
  return `${(nombre || '?')[0]}${(apellido || '?')[0]}`.toUpperCase();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function playNotificationSound() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleDs+i9NkW0xRhbGoh2k0KkeXu9h+OhMuZp3N0plkNjlnka+0dk8jLFqPu9p/NxMsZpzM0pllNThnka+0eE8jLFqPutl+NxMsZpzM0pllNTlnka+0d08jLFqPutl+NxMsZp3M0pllNTlnkK+0d08jLFqPutl+NxQsZp3M0ZllNTlokaKrhF0jKFeJpqt0ShsqZJqRd0knJl2XmIRjMSY/Tml9allPZo2KaT0qN1dxd2FMSFmBiG05KTdWc3xkUE5eiYhsOyk3VnJ7Y09OXomIbDspN1Zye2NPTl6JiGw7KTdWcntjT05eiYhsOyk3VnJ7Y09OXomIbDspN1Zze2NPTl6JiGw7KTdWcntjT05eiYhsOyk3VnJ7Y09OXomIbDsoN1Zye2NPTl6JiGw7KDdWcntjT09eiYhrOyg3VnJ7Y09PXYiIazsoN1Zye2NPT12IiGs7KDdWcntjT09diIhrOyg3VnJ7Y09PXYiIazsoN1Zye2NPT12IiGs7KDdWcntiT09diIhrOyg3VnJ7Yk9PXYiIazsoN1Zye2JPT12IiGs8KDdVcntiT09dh4hrPCg3VXJ7Yk9PXYeIazwoN1Vye2JPT12HiGs8KDdVcntiT09dh4hrPCg3VXJ6Yk9PXYeIazwoN1VyemJPT12HiGs8KDdVcnpiT09dh4hrPCg3VXJ6Yk9PXYeIazwoN1Vye2JPT12HiGs8KDdVcntiT09dh4hrOyg3VXJ7Yk9PXYeIazsoN1Vye2JPT12IiGs7KDdWcntiT09diIhrOyg3VnJ7Yk9PXYiIazsoN1Zye2JPT12IiGs7KDdWcntiT09diIhrOyg3VnJ7Yk9PXYiIazsoN1Zye2NPT12IiGs7KDdWcntjT09diIhrOyg3VnJ7Y09PXYiIazsoN1Zye2NPT12IiGw7KDdWcntjT09eiIhsOyg3VnJ7Y09OXomIbDspN1Zye2NPTl6JiGw7KTdWcntjT05eiYhsOyk3VnN7Y09OXomIbDspN1Zze2NPTl6IiGw7KTdXc3tjT05eiYhsOyk3V3N8Y1BOXomIbTspN1dze2NQTl2JiG07KTdXc3xjUE5diYhtOik3V3N8Y1BPXYmJbTopOFdzfGRQT12JiW06KThXc3xkUE9diYptOik4V3N8ZFBPXY0=');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch (e) {}
}

function cerrarSesion() {
  actualizarEstado('desconectado');
  if (activityInterval) clearInterval(activityInterval);
  if (pusher) pusher.disconnect();
  localStorage.removeItem('alumnoActual');
  window.location.href = 'alumno-login.html';
}

window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/.netlify/functions/social-estado', JSON.stringify({
    userId: currentUser?.id,
    estado: 'desconectado'
  }));
  if (pusher) pusher.disconnect();
});

// Refrescar amigos cada 30 seg
setInterval(() => {
  if (document.visibilityState === 'visible') {
    cargarAmigos();
  }
}, 30000);