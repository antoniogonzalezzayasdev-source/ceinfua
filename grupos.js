// js/grupos.js - Sistema de Grupos de Estudio CEINFUA v2
// Con localStorage, reacciones estilo WhatsApp, mensajes fijados

const PUSHER_KEY = '32b8754ae93021dc8617';
const PUSHER_CLUSTER = 'sa1';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_MENSAJES_LOCAL = 100;
const EMOJIS_REACCION = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

let currentUser = null;
let currentGrupo = null;
let pusher = null;
let grupoChannel = null;
let typingTimeout = null;
let mensajesLocales = {};

// ===========================
// INICIALIZACIÓN
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  currentUser = JSON.parse(localStorage.getItem('alumnoActual'));
  
  if (!currentUser || !currentUser.id) {
    alert('Debés iniciar sesión para acceder a los grupos');
    window.location.href = 'alumno-login.html';
    return;
  }

  cargarMensajesLocales();
  initPusher();
  cargarMisGrupos();
  setupEventListeners();
});

// ===========================
// LOCAL STORAGE
// ===========================
function cargarMensajesLocales() {
  try {
    const stored = localStorage.getItem('ceinfua_grupos_mensajes');
    if (stored) mensajesLocales = JSON.parse(stored);
  } catch (e) {
    mensajesLocales = {};
  }
}

function guardarMensajesLocales() {
  try {
    localStorage.setItem('ceinfua_grupos_mensajes', JSON.stringify(mensajesLocales));
  } catch (e) {
    // Si está lleno, limpiar
    for (const gid in mensajesLocales) {
      mensajesLocales[gid] = mensajesLocales[gid].slice(-50);
    }
    localStorage.setItem('ceinfua_grupos_mensajes', JSON.stringify(mensajesLocales));
  }
}

function agregarMensajeLocal(grupoId, mensaje) {
  const gid = String(grupoId);
  if (!mensajesLocales[gid]) mensajesLocales[gid] = [];
  
  mensaje.id = mensaje.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  mensaje.reacciones = mensaje.reacciones || {};
  
  mensajesLocales[gid].push(mensaje);
  
  if (mensajesLocales[gid].length > MAX_MENSAJES_LOCAL) {
    mensajesLocales[gid] = mensajesLocales[gid].slice(-MAX_MENSAJES_LOCAL);
  }
  
  guardarMensajesLocales();
  return mensaje.id;
}

function obtenerMensajesLocales(grupoId) {
  return mensajesLocales[String(grupoId)] || [];
}

function agregarReaccionLocal(grupoId, mensajeId, emoji, odrigoId, userName) {
  const gid = String(grupoId);
  if (!mensajesLocales[gid]) return false;
  
  const mensaje = mensajesLocales[gid].find(m => m.id === mensajeId);
  if (!mensaje) {
    console.log('Mensaje no encontrado:', mensajeId);
    return false;
  }
  
  if (!mensaje.reacciones) mensaje.reacciones = {};
  if (!mensaje.reacciones[emoji]) mensaje.reacciones[emoji] = [];
  
  // Verificar si ya reaccionó con este emoji
  const yaReacciono = mensaje.reacciones[emoji].some(r => r.id === odrigoId);
  
  if (yaReacciono) {
    // Quitar reacción (toggle)
    mensaje.reacciones[emoji] = mensaje.reacciones[emoji].filter(r => r.id !== odrigoId);
    if (mensaje.reacciones[emoji].length === 0) {
      delete mensaje.reacciones[emoji];
    }
  } else {
    // Agregar reacción
    mensaje.reacciones[emoji].push({ id: odrigoId, nombre: userName });
  }
  
  guardarMensajesLocales();
  return true;
}

// ===========================
// PUSHER
// ===========================
function initPusher() {
  pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER, forceTLS: true });
}

function suscribirseAGrupo(grupoId) {
  if (grupoChannel) pusher.unsubscribe(grupoChannel.name);

  grupoChannel = pusher.subscribe(`grupo-${grupoId}`);
  
  grupoChannel.bind('nuevo-mensaje', (data) => {
    if (data.de_id !== currentUser.id) {
      const msgId = agregarMensajeLocal(grupoId, data);
      data.id = msgId;
      renderizarMensaje(data, 'received');
      playNotificationSound();
    }
  });

  grupoChannel.bind('typing', (data) => {
    if (data.de_id !== currentUser.id) mostrarTyping(data.de_nombre);
  });

  grupoChannel.bind('nueva-reaccion', (data) => {
    if (data.de_id !== currentUser.id) {
      agregarReaccionLocal(grupoId, data.mensaje_id, data.emoji, data.de_id, data.de_nombre);
      actualizarReaccionUI(data.mensaje_id);
    }
  });

  grupoChannel.bind('mensaje-fijado', (data) => {
    mostrarMensajeFijado(data.mensaje, data.fijado_por);
    showToast('📌 Mensaje fijado', 'success');
  });

  grupoChannel.bind('mensaje-desfijado', () => ocultarMensajeFijado());

  console.log('Suscrito a grupo-' + grupoId);
}

// ===========================
// EVENT LISTENERS
// ===========================
function setupEventListeners() {
  document.getElementById('btnCrearGrupo')?.addEventListener('click', () => 
    document.getElementById('modalCrear').classList.add('show'));
  document.getElementById('formCrearGrupo')?.addEventListener('submit', crearGrupo);
  document.getElementById('cancelarCrear')?.addEventListener('click', cerrarModales);

  document.getElementById('btnUnirseGrupo')?.addEventListener('click', () =>
    document.getElementById('modalUnirse').classList.add('show'));
  document.getElementById('formUnirse')?.addEventListener('submit', unirseConCodigo);
  document.getElementById('cancelarUnirse')?.addEventListener('click', cerrarModales);

  document.getElementById('btnEditarGrupo')?.addEventListener('click', mostrarModalEditar);
  document.getElementById('formEditarGrupo')?.addEventListener('submit', editarGrupo);
  document.getElementById('cancelarEditar')?.addEventListener('click', cerrarModales);

  document.getElementById('btnFijarMensaje')?.addEventListener('click', mostrarModalFijar);
  document.getElementById('formFijarMensaje')?.addEventListener('submit', fijarMensaje);
  document.getElementById('cancelarFijar')?.addEventListener('click', cerrarModales);
  document.getElementById('btnDesfijar')?.addEventListener('click', desfijarMensaje);

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModales(); });
  });

  document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
  });
  document.getElementById('messageInput')?.addEventListener('input', () => {
    if (currentGrupo) enviarTyping();
  });
  document.getElementById('sendBtn')?.addEventListener('click', enviarMensaje);
  document.getElementById('btnEmoji')?.addEventListener('click', toggleEmojiPicker);

  document.getElementById('btnAdjuntar')?.addEventListener('click', () =>
    document.getElementById('fileInput')?.click());
  document.getElementById('fileInput')?.addEventListener('change', manejarArchivo);

  document.getElementById('btnCopiarCodigo')?.addEventListener('click', copiarCodigo);
  document.getElementById('btnSalirGrupo')?.addEventListener('click', salirDelGrupo);

  document.getElementById('nav-logout')?.addEventListener('click', (e) => {
    e.preventDefault(); cerrarSesion();
  });

  // Cerrar popups al hacer clic afuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.emoji-picker-container') && !e.target.closest('#btnEmoji')) {
      document.getElementById('emojiPicker')?.classList.remove('show');
    }
    if (!e.target.closest('.emoji-popup') && !e.target.closest('.btn-reaccionar')) {
      cerrarPopupReacciones();
    }
  });
}

function cerrarModales() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
}

function mostrarModalEditar() {
  if (!currentGrupo?.es_admin) return showToast('Solo el admin puede editar', 'error');
  document.getElementById('editNombre').value = currentGrupo.nombre || '';
  document.getElementById('editMateria').value = currentGrupo.materia || '';
  document.getElementById('editDescripcion').value = currentGrupo.descripcion || '';
  document.getElementById('modalEditar').classList.add('show');
}

function mostrarModalFijar() {
  if (!currentGrupo?.es_admin) return showToast('Solo el admin puede fijar', 'error');
  document.getElementById('mensajeFijar').value = '';
  document.getElementById('modalFijar').classList.add('show');
}

// ===========================
// GRUPOS CRUD
// ===========================
async function cargarMisGrupos() {
  const lista = document.getElementById('listaGrupos');
  lista.innerHTML = '<div class="loader"></div>';

  try {
    const resp = await fetch(`/.netlify/functions/grupos-listar?userId=${currentUser.id}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

    if (!data.grupos?.length) {
      lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><p>No tenés grupos</p></div>';
      return;
    }

    lista.innerHTML = data.grupos.map(g => `
      <div class="grupo-item ${currentGrupo?.id === g.id ? 'active' : ''}" onclick="abrirGrupo(${g.id})">
        <div class="grupo-icon">${g.materia?.[0]?.toUpperCase() || '📚'}</div>
        <div class="grupo-info">
          <strong>${escapeHtml(g.nombre)}</strong>
          <small>${g.materia || 'Sin materia'} · ${g.total_miembros} miembros</small>
        </div>
        ${g.rol === 'admin' ? '<span class="badge-admin">Admin</span>' : ''}
      </div>
    `).join('');
  } catch (err) {
    lista.innerHTML = '<p class="empty-state">Error al cargar</p>';
  }
}

async function crearGrupo(e) {
  e.preventDefault();
  const nombre = document.getElementById('grupoNombre').value.trim();
  const materia = document.getElementById('grupoMateria').value.trim();
  const descripcion = document.getElementById('grupoDescripcion').value.trim();

  if (!nombre) return showToast('Ingresá un nombre', 'error');

  try {
    const resp = await fetch('/.netlify/functions/grupos-crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, materia, descripcion, creadorId: currentUser.id })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

    showToast('🎉 Grupo creado', 'success');
    cerrarModales();
    document.getElementById('formCrearGrupo').reset();
    await cargarMisGrupos();
    if (data.grupo?.id) setTimeout(() => abrirGrupo(data.grupo.id), 300);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function unirseConCodigo(e) {
  e.preventDefault();
  const codigo = document.getElementById('codigoInvitacion').value.trim().toUpperCase();
  if (!codigo) return showToast('Ingresá un código', 'error');

  try {
    const resp = await fetch('/.netlify/functions/grupos-unirse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, userId: currentUser.id })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

    showToast(`🎉 ${data.message}`, 'success');
    cerrarModales();
    document.getElementById('formUnirse').reset();
    await cargarMisGrupos();
    if (data.grupo?.id) setTimeout(() => abrirGrupo(data.grupo.id), 300);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editarGrupo(e) {
  e.preventDefault();
  try {
    const resp = await fetch('/.netlify/functions/grupos-editar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupoId: currentGrupo.id,
        userId: currentUser.id,
        nombre: document.getElementById('editNombre').value.trim(),
        materia: document.getElementById('editMateria').value.trim(),
        descripcion: document.getElementById('editDescripcion').value.trim()
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

    showToast('✅ Actualizado', 'success');
    cerrarModales();
    Object.assign(currentGrupo, { 
      nombre: data.grupo?.nombre || currentGrupo.nombre,
      materia: data.grupo?.materia || currentGrupo.materia,
      descripcion: data.grupo?.descripcion || currentGrupo.descripcion
    });
    actualizarHeaderGrupo();
    cargarMisGrupos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function abrirGrupo(grupoId) {
  try {
    const resp = await fetch(`/.netlify/functions/grupos-detalle?grupoId=${grupoId}&userId=${currentUser.id}`);
    const data = await resp.json();
    if (!resp.ok || !data.grupo) throw new Error(data.error || 'Error');

    currentGrupo = data.grupo;
    suscribirseAGrupo(grupoId);

    document.getElementById('chatEmpty').style.display = 'none';
    document.getElementById('chatActive').style.display = 'flex';

    actualizarHeaderGrupo();
    document.querySelectorAll('.admin-only').forEach(b => 
      b.style.display = currentGrupo.es_admin ? 'inline-flex' : 'none');
    
    renderizarMiembros(data.miembros);

    if (data.mensaje_fijado) {
      mostrarMensajeFijado(data.mensaje_fijado.texto, data.mensaje_fijado.fijado_por);
    } else {
      ocultarMensajeFijado();
    }

    // Renderizar mensajes
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    
    const msgs = obtenerMensajesLocales(grupoId);
    if (msgs.length) {
      msgs.forEach(m => renderizarMensaje(m, m.de_id === currentUser.id ? 'sent' : 'received', false));
    } else {
      container.innerHTML = `
        <div class="mensaje-sistema">
          <span>🎉 Bienvenido a "${data.grupo.nombre}"</span>
          <small>Los mensajes se guardan localmente</small>
        </div>
      `;
    }

    container.scrollTop = container.scrollHeight;
    cargarMisGrupos();
    document.getElementById('messageInput').focus();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function actualizarHeaderGrupo() {
  document.getElementById('chatGrupoNombre').textContent = currentGrupo.nombre || 'Grupo';
  document.getElementById('chatGrupoInfo').textContent = currentGrupo.materia || 'Sin materia';
  document.getElementById('codigoGrupo').textContent = currentGrupo.codigo_invitacion || '---';
  const desc = document.getElementById('chatGrupoDesc');
  if (desc) {
    desc.textContent = currentGrupo.descripcion || '';
    desc.style.display = currentGrupo.descripcion ? 'block' : 'none';
  }
}

function renderizarMiembros(miembros) {
  const lista = document.getElementById('listaMiembros');
  if (!miembros?.length) {
    lista.innerHTML = '<p class="empty-state">Sin miembros</p>';
    return;
  }
  lista.innerHTML = miembros.map(m => `
    <div class="miembro-item">
      <div class="miembro-avatar">
        ${getInitials(m.nombre, m.apellido)}
        <span class="status-dot" style="background:${estaEnLinea(m.ultima_conexion)?'#10b981':'#6b7280'}"></span>
      </div>
      <div class="miembro-info">
        <strong>${m.nombre} ${m.apellido}</strong>
        <small>${m.rol === 'admin' ? '👑 Admin' : 'Miembro'}</small>
      </div>
    </div>
  `).join('');
}

async function salirDelGrupo() {
  if (!currentGrupo) return;
  const msg = currentGrupo.creador_id === currentUser.id ? '¿Eliminar grupo para todos?' : '¿Salir del grupo?';
  if (!confirm(msg)) return;

  try {
    const resp = await fetch('/.netlify/functions/grupos-salir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grupoId: currentGrupo.id, odrigoId: currentUser.id })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

    delete mensajesLocales[String(currentGrupo.id)];
    guardarMensajesLocales();
    showToast(data.message, 'success');

    if (grupoChannel) pusher.unsubscribe(grupoChannel.name);
    grupoChannel = null;
    currentGrupo = null;
    document.getElementById('chatActive').style.display = 'none';
    document.getElementById('chatEmpty').style.display = 'flex';
    cargarMisGrupos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function copiarCodigo() {
  navigator.clipboard.writeText(document.getElementById('codigoGrupo').textContent);
  showToast('📋 Código copiado', 'success');
}

// ===========================
// MENSAJE FIJADO
// ===========================
function mostrarMensajeFijado(texto, fijadoPor) {
  const c = document.getElementById('mensajeFijadoContainer');
  if (!c) return;
  document.getElementById('mensajeFijadoTexto').textContent = texto;
  document.getElementById('mensajeFijadoPor').textContent = `Fijado por ${fijadoPor}`;
  c.style.display = 'flex';
}

function ocultarMensajeFijado() {
  const c = document.getElementById('mensajeFijadoContainer');
  if (c) c.style.display = 'none';
}

async function fijarMensaje(e) {
  e.preventDefault();
  const mensaje = document.getElementById('mensajeFijar').value.trim();
  if (!mensaje) return showToast('Escribí algo', 'error');

  try {
    const resp = await fetch('/.netlify/functions/grupos-fijar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grupoId: currentGrupo.id, odrigoId: currentUser.id, mensaje, accion: 'fijar' })
    });
    if (!resp.ok) throw new Error((await resp.json()).error);

    showToast('📌 Fijado', 'success');
    cerrarModales();
    mostrarMensajeFijado(mensaje, `${currentUser.nombre} ${currentUser.apellido}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function desfijarMensaje() {
  if (!confirm('¿Desfijar?')) return;
  try {
    const resp = await fetch('/.netlify/functions/grupos-fijar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grupoId: currentGrupo.id, odrigoId: currentUser.id, accion: 'desfijar' })
    });
    if (!resp.ok) throw new Error((await resp.json()).error);
    showToast('Desfijado', 'success');
    ocultarMensajeFijado();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===========================
// MENSAJES
// ===========================
async function enviarMensaje() {
  const input = document.getElementById('messageInput');
  const texto = input.value.trim();
  if (!texto || !currentGrupo) return;

  input.value = '';

  const msgData = {
    de_id: currentUser.id,
    de_nombre: `${currentUser.nombre} ${currentUser.apellido}`,
    mensaje: texto,
    tipo: 'texto',
    timestamp: new Date().toISOString()
  };

  msgData.id = agregarMensajeLocal(currentGrupo.id, msgData);
  renderizarMensaje(msgData, 'sent');

  try {
    await fetch('/.netlify/functions/grupo-mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupoId: currentGrupo.id,
        deId: currentUser.id,
        deNombre: msgData.de_nombre,
        mensaje: texto,
        tipo: 'texto'
      })
    });
  } catch (err) {
    console.error('Error enviando:', err);
  }
}

function renderizarMensaje(data, tipo, scroll = true) {
  const container = document.getElementById('chatMessages');
  const time = new Date(data.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  const div = document.createElement('div');
  div.className = `message ${tipo}`;
  div.id = `msg-${data.id}`;

  const contenido = data.tipo === 'archivo' && data.archivo 
    ? crearVistaArchivo(data.archivo) 
    : `<div class="message-text">${escapeHtml(data.mensaje)}</div>`;

  div.innerHTML = `
    ${tipo === 'received' ? `<div class="message-author">${escapeHtml(data.de_nombre)}</div>` : ''}
    ${contenido}
    <div class="message-meta">
      <span class="message-time">${time}</span>
      <button class="btn-reaccionar" title="Reaccionar">😊</button>
    </div>
    <div class="message-reacciones" id="reacciones-${data.id}"></div>
  `;

  // Botón de reacción
  div.querySelector('.btn-reaccionar').addEventListener('click', function(e) {
    e.stopPropagation();
    mostrarPopupReacciones(this, data.id);
  });

  container.appendChild(div);
  
  // Renderizar reacciones existentes
  actualizarReaccionUI(data.id);
  
  if (scroll) container.scrollTop = container.scrollHeight;
}

// ===========================
// SISTEMA DE REACCIONES
// ===========================
function mostrarPopupReacciones(btn, msgId) {
  cerrarPopupReacciones();

  const popup = document.createElement('div');
  popup.className = 'emoji-popup';
  popup.id = 'emoji-popup-activo';

  EMOJIS_REACCION.forEach(emoji => {
    const span = document.createElement('span');
    span.textContent = emoji;
    span.className = 'emoji-option';
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      hacerReaccion(msgId, emoji);
      cerrarPopupReacciones();
    });
    popup.appendChild(span);
  });

  // Posicionar
  const rect = btn.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = (rect.top - 60) + 'px';
  popup.style.left = Math.max(10, rect.left - 120) + 'px';

  document.body.appendChild(popup);
}

function cerrarPopupReacciones() {
  document.getElementById('emoji-popup-activo')?.remove();
}

async function hacerReaccion(msgId, emoji) {
  if (!currentGrupo) return;

  console.log('Reaccionando a:', msgId, 'con:', emoji);

  // Guardar localmente
  const success = agregarReaccionLocal(currentGrupo.id, msgId, emoji, currentUser.id, currentUser.nombre);
  console.log('Guardado local:', success);

  // Actualizar UI
  actualizarReaccionUI(msgId);

  // Enviar al servidor
  try {
    const resp = await fetch('/.netlify/functions/grupo-reaccion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupoId: currentGrupo.id,
        mensajeId: msgId,
        emoji: emoji,
        deId: currentUser.id,
        deNombre: currentUser.nombre
      })
    });
    console.log('Respuesta servidor:', resp.status);
  } catch (err) {
    console.error('Error:', err);
  }
}

function actualizarReaccionUI(msgId) {
  const gid = String(currentGrupo?.id);
  const msg = mensajesLocales[gid]?.find(m => m.id === msgId);
  
  const container = document.getElementById(`reacciones-${msgId}`);
  if (!container) return;

  if (!msg?.reacciones || Object.keys(msg.reacciones).length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = Object.entries(msg.reacciones).map(([emoji, usuarios]) => {
    const miReaccion = usuarios.some(u => u.id === currentUser.id);
    const nombres = usuarios.map(u => u.nombre).join(', ');
    return `<span class="reaccion-badge ${miReaccion ? 'mi-reaccion' : ''}" 
                  data-emoji="${emoji}" 
                  data-msgid="${msgId}" 
                  title="${nombres}">${emoji} ${usuarios.length}</span>`;
  }).join('');

  // Event listeners
  container.querySelectorAll('.reaccion-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      hacerReaccion(badge.dataset.msgid, badge.dataset.emoji);
    });
  });
}

// ===========================
// EMOJI PICKER (input)
// ===========================
function toggleEmojiPicker() {
  document.getElementById('emojiPicker')?.classList.toggle('show');
}

function insertarEmoji(emoji) {
  const input = document.getElementById('messageInput');
  input.value += emoji;
  input.focus();
  document.getElementById('emojiPicker')?.classList.remove('show');
}

// ===========================
// ARCHIVOS
// ===========================
async function manejarArchivo(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) return showToast('Máximo 5MB', 'error');

  showToast('📤 Enviando...', 'success');

  try {
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    const archivo = { nombre: file.name, tipo: file.type, tamaño: file.size, base64 };
    const msgData = {
      de_id: currentUser.id,
      de_nombre: `${currentUser.nombre} ${currentUser.apellido}`,
      tipo: 'archivo',
      archivo,
      timestamp: new Date().toISOString()
    };

    msgData.id = agregarMensajeLocal(currentGrupo.id, msgData);
    renderizarMensaje(msgData, 'sent');

    await fetch('/.netlify/functions/grupo-mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupoId: currentGrupo.id,
        deId: currentUser.id,
        deNombre: msgData.de_nombre,
        tipo: 'archivo',
        archivo
      })
    });

    showToast('✅ Enviado', 'success');
  } catch (err) {
    showToast('Error al enviar', 'error');
  }
  e.target.value = '';
}

function crearVistaArchivo(a) {
  if (a.tipo?.startsWith('image/') && a.base64) {
    return `<div class="message-file"><img src="data:${a.tipo};base64,${a.base64}" class="message-image" onclick="window.open(this.src)"></div>`;
  }
  if (a.base64) {
    return `<div class="message-file"><a href="data:${a.tipo};base64,${a.base64}" download="${a.nombre}" class="file-download">📎 ${escapeHtml(a.nombre)}</a></div>`;
  }
  return `<div class="message-file">📎 ${escapeHtml(a.nombre)}</div>`;
}

// ===========================
// TYPING
// ===========================
function enviarTyping() {
  if (typingTimeout) clearTimeout(typingTimeout);
  fetch('/.netlify/functions/grupo-typing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grupoId: currentGrupo.id, deId: currentUser.id, deNombre: currentUser.nombre })
  }).catch(() => {});
  typingTimeout = setTimeout(() => typingTimeout = null, 2000);
}

function mostrarTyping(nombre) {
  const el = document.getElementById('typingIndicator');
  document.getElementById('typingText').textContent = `${nombre} escribe...`;
  el.style.display = 'flex';
  setTimeout(() => el.style.display = 'none', 3000);
}

// ===========================
// UTILIDADES
// ===========================
function getInitials(n, a) { return `${(n||'?')[0]}${(a||'?')[0]}`.toUpperCase(); }
function escapeHtml(t) { if(!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function estaEnLinea(u) { return u && (new Date() - new Date(u)) / 60000 < 5; }

function showToast(msg, type = 'success') {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function playNotificationSound() {
  try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ').play(); } catch(e) {}
}

function cerrarSesion() {
  if (grupoChannel) pusher.unsubscribe(grupoChannel.name);
  pusher?.disconnect();
  localStorage.removeItem('alumnoActual');
  location.href = 'alumno-login.html';
}

window.addEventListener('beforeunload', () => pusher?.disconnect());