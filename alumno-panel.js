// js/alumno-panel.js (versión final)

// ===========================
// CONFIGURACIÓN DEL SEMESTRE
// ===========================
const CONFIG_SEMESTRE_DEFAULT = {
  inicio: "2025-03-01",
  fin: "2025-07-31",
};
const SEMESTRE_STORAGE_KEY = "ceinfua-semestre-config";
let semestreConfigActual = null;
let relojIntervalId = null;

// ===========================
// SESIÓN DEL ALUMNO
// ===========================
function cargarAlumnoDesdeStorage() {
  const data = localStorage.getItem("alumnoActual");
  if (!data) {
    window.location.href = "alumno-login.html";
    return null;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Error parseando alumnoActual:", e);
    localStorage.removeItem("alumnoActual");
    window.location.href = "alumno-login.html";
    return null;
  }
}

function mostrarDatosAlumno(alumno) {
  const nombreEl = document.getElementById("alumnoNombre");
  const nombreCompletoEl = document.getElementById("alumnoNombreCompleto");
  const correoEl = document.getElementById("alumnoCorreo");
  const semestreEl = document.getElementById("alumnoSemestre");
  const estadoEl = document.getElementById("alumnoEstado");

  if (nombreEl) nombreEl.textContent = alumno.nombre || "";
  if (nombreCompletoEl)
    nombreCompletoEl.textContent = `${alumno.nombre || ""} ${alumno.apellido || ""}`.trim();
  if (correoEl) correoEl.textContent = alumno.correo || "";
  if (semestreEl) semestreEl.textContent = alumno.semestre || "";
  if (estadoEl) estadoEl.textContent = alumno.estado || "";

  actualizarSaludoDinamico(alumno);
}

// ===========================
// SALUDO DINÁMICO
// ===========================
function actualizarSaludoDinamico(alumno) {
  const saludoEl = document.getElementById("saludoDinamico");
  if (!saludoEl) return;

  const ahora = new Date();
  const h = ahora.getHours();

  let saludoBase = "Buen día";
  if (h >= 6 && h < 12) saludoBase = "Buen día";
  else if (h >= 12 && h < 19) saludoBase = "Buenas tardes";
  else saludoBase = "Buenas noches";

  const nombre = alumno?.nombre || "";
  saludoEl.textContent = `${saludoBase}${nombre ? ", " + nombre : ""}. Recordá que CEINFUA está para ayudarte.`;
}

// ===========================
// CLIMA DINÁMICO (API + día / noche)
// ===========================
async function cargarClimaAlumno() {
  const tempEl = document.getElementById("clima-temp");
  const msgEl  = document.getElementById("clima-msg");
  const iconEl = document.getElementById("clima-icono");

  if (!tempEl || !msgEl || !iconEl) return;

  try {
    // Coordenadas (ej: Asunción). Podés cambiarlas si querés.
    const lat = -25.2969;
    const lon = -57.6682;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

    const res = await fetch(url);
    const data = await res.json();
    const current = data.current_weather;

    if (!current) throw new Error("No hay current_weather");

    const temp = Math.round(current.temperature);
    const codigo = current.weathercode;
    const isDay = current.is_day === 1; // 1 = día, 0 = noche

    let estado = "Desconocido";
    let icono = "⛅";
    let mensaje = "Disfrutá tu día 🧡";

    if (codigo === 0) {
      if (isDay) {
        estado = "Despejado";
        icono = "☀️";
        mensaje = "Relajate, hoy está todo soleado 😎";
      } else {
        estado = "Noche despejada";
        icono = "🌙";
        mensaje = "Noche tranquila, ideal para descansar 😴";
      }
    } else if ([1, 2, 3].includes(codigo)) {
      if (isDay) {
        estado = "Parcialmente nublado";
        icono = "⛅";
        mensaje = "Día tranqui para estudiar con un tereré 😉";
      } else {
        estado = "Noche nublada";
        icono = "☁️";
        mensaje = "Noche nublada, organizá el día de mañana 📅";
      }
    } else if ([61, 63, 65].includes(codigo)) {
      if (isDay) {
        estado = "Lluvia";
        icono = "🌧️";
        mensaje = "No olvides tu paraguas ☔";
      } else {
        estado = "Lluvia nocturna";
        icono = "🌧️";
        mensaje = "Ideal para una noche de estudio con lluvia de fondo 📚";
      }
    } else {
      if (!isDay) {
        icono = "🌙";
        mensaje = "Que tengas una buena noche 🌙";
      }
    }

    tempEl.textContent = `${temp}°C · ${estado}`;
    msgEl.textContent  = mensaje;
    iconEl.textContent = icono;

  } catch (e) {
    console.error("Error cargando clima:", e);
    tempEl.textContent = "Clima no disponible";
    msgEl.textContent = "Pero vos seguí con todo 🔥";
    iconEl.textContent = "💤";
  }
}

// ===========================
// NOTICIAS (placeholder)
// ===========================
async function cargarNoticias() {
  const contenedor = document.getElementById("portalNoticias");
  if (!contenedor) return;
  // Por ahora no mostramos noticias en el portal
}

// ===========================
// LOGOUT
// ===========================
function configurarLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    localStorage.removeItem("alumnoActual");
    window.location.href = "alumno-login.html";
  });
}

// ===========================
// CONSEJO / FRASE RANDOM
// ===========================
function obtenerConsejoDelDia() {
  const consejos = [
    "Tomate 5 minutos para ordenar tus pendientes del día.",
    "No subestimes los descansos cortos, tu cerebro también necesita respirar.",
    "Pedí ayuda si te trabaste, no estás solo en la carrera.",
    "Un poco cada día > mucho de golpe y nunca más.",
    "Hidratate bien, el tereré también cuenta 😎.",
    "Apagá notificaciones 25 minutos y enfocáte solo en una cosa.",
    "Lo perfecto es enemigo de lo hecho: entregá, aunque no esté perfecto.",
    "Dormir bien rinde más que estudiar destruido.",
    "Tu yo del futuro te va a agradecer por lo que avances hoy.",
    "No te compares, cada uno tiene su ritmo.",
    "Equivocarse también es parte de aprender.",
    "Hoy podés avanzar aunque sea un poquito, y eso ya suma.",
    "No tenés que hacerlo todo hoy, pero sí algo.",
    "Cada línea de código es experiencia que ganás.",
    "No sos tu nota, sos mucho más que eso.",
  ];

  const indice = Math.floor(Math.random() * consejos.length);
  return consejos[indice];
}

function mostrarConsejoDelDia() {
  const consejoEl = document.getElementById("textoConsejo");
  if (!consejoEl) return;

  consejoEl.textContent = obtenerConsejoDelDia();
}

// ===========================
// SEMESTRE: STORAGE
// ===========================
function cargarSemestreDesdeStorage() {
  const data = localStorage.getItem(SEMESTRE_STORAGE_KEY);
  if (!data) {
    semestreConfigActual = { ...CONFIG_SEMESTRE_DEFAULT };
    return;
  }
  try {
    const parsed = JSON.parse(data);
    if (parsed && parsed.inicio && parsed.fin) {
      semestreConfigActual = parsed;
    } else {
      semestreConfigActual = { ...CONFIG_SEMESTRE_DEFAULT };
    }
  } catch {
    semestreConfigActual = { ...CONFIG_SEMESTRE_DEFAULT };
  }
}

function guardarSemestreEnStorage(cfg) {
  semestreConfigActual = cfg;
  localStorage.setItem(SEMESTRE_STORAGE_KEY, JSON.stringify(cfg));
}

function getSemestreConfig() {
  if (!semestreConfigActual) {
    cargarSemestreDesdeStorage();
  }
  return semestreConfigActual || CONFIG_SEMESTRE_DEFAULT;
}

// ===========================
// CÁLCULOS SEMESTRE
// ===========================
function calcularProgresoSemestre(now = new Date()) {
  const config = getSemestreConfig();
  const inicio = new Date(`${config.inicio}T00:00:00`);
  const fin = new Date(`${config.fin}T23:59:59`);

  const totalMs = fin - inicio;
  const totalDias = totalMs / (1000 * 60 * 60 * 24);

  const transMs = now - inicio;
  const transDias = transMs / (1000 * 60 * 60 * 24);

  if (transMs <= 0) {
    return {
      estado: "antes",
      porcentaje: 0,
      semanaActual: 0,
      totalSemanas: Math.max(1, Math.ceil(totalDias / 7)),
      inicio,
      fin,
    };
  }

  if (now >= fin) {
    return {
      estado: "despues",
      porcentaje: 100,
      semanaActual: Math.max(1, Math.ceil(totalDias / 7)),
      totalSemanas: Math.max(1, Math.ceil(totalDias / 7)),
      inicio,
      fin,
    };
  }

  const porcentaje = Math.min(100, Math.max(0, (transDias / totalDias) * 100));
  const totalSemanas = Math.max(1, Math.ceil(totalDias / 7));
  const semanaActual = Math.min(
    totalSemanas,
    Math.max(1, Math.ceil(transDias / 7))
  );

  return {
    estado: "en_curso",
    porcentaje: Math.round(porcentaje),
    semanaActual,
    totalSemanas,
    inicio,
    fin,
  };
}

function formatearHoraMinutos(date) {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ===========================
// UI SEMESTRE (form + progreso + preview)
// ===========================
function aplicarConfigEnFormulario() {
  const cfg = getSemestreConfig();
  const inicioInput = document.getElementById("fechaInicioSemestre");
  const finInput = document.getElementById("fechaFinSemestre");

  if (inicioInput) inicioInput.value = cfg.inicio;
  if (finInput) finInput.value = cfg.fin;
}

function configurarFormularioSemestre() {
  const btn = document.getElementById("guardarSemestreBtn");
  if (!btn) return;

  const inicioInput = document.getElementById("fechaInicioSemestre");
  const finInput = document.getElementById("fechaFinSemestre");
  const mensajeEl = document.getElementById("mensajeSemestre");

  btn.addEventListener("click", () => {
    if (!inicioInput || !finInput) return;

    const inicio = inicioInput.value;
    const fin = finInput.value;

    if (!inicio || !fin) {
      if (mensajeEl)
        mensajeEl.textContent = "Completá ambas fechas antes de guardar.";
      return;
    }

    if (inicio > fin) {
      if (mensajeEl)
        mensajeEl.textContent = "La fecha de inicio no puede ser mayor al fin.";
      return;
    }

    guardarSemestreEnStorage({ inicio, fin });

    if (mensajeEl) mensajeEl.textContent = "Fechas guardadas ✅";

    // refrescar progreso inmediatamente
    iniciarRelojYProgreso(true);

    // actualizar preview
    const info = calcularProgresoSemestre(new Date());
    actualizarPreviewSemestre(info, getSemestreConfig());
  });
}

function actualizarPreviewSemestre(info, config) {
  const pillEl = document.getElementById("semestrePreviewPill");
  const prevTextEl = document.getElementById("semestrePreviewText");

  if (!pillEl || !prevTextEl) return;

  if (info.estado === "antes") {
    pillEl.textContent = "Sin iniciar";
    const [anio, mes, dia] = config.inicio.split("-");
    prevTextEl.textContent = `Empieza el ${dia}/${mes}/${anio}`;
  } else if (info.estado === "despues") {
    pillEl.textContent = "Finalizado";
    prevTextEl.textContent = "Semestre completado 🎓";
  } else {
    pillEl.textContent = "En curso";
    prevTextEl.textContent = `Semana ${info.semanaActual} de ${info.totalSemanas} · ${info.porcentaje}%`;
  }
}

function iniciarRelojYProgreso(forceRestart = false) {
  const relojEl = document.getElementById("textoRelojSemestre");
  const barraEl = document.getElementById("barraSemestre");
  const textoSemestreEl = document.getElementById("textoSemestre");

  if (!relojEl || !barraEl || !textoSemestreEl) return;

  if (forceRestart && relojIntervalId) {
    clearInterval(relojIntervalId);
    relojIntervalId = null;
  }

  function actualizar() {
    const ahora = new Date();
    const info = calcularProgresoSemestre(ahora);
    const cfg = getSemestreConfig();

    if (info.estado === "despues") {
      relojEl.textContent = `${formatearHoraMinutos(ahora)} — Semestre finalizado`;
    } else if (info.estado === "antes") {
      relojEl.textContent = `${formatearHoraMinutos(ahora)} — Semestre todavía no inició`;
    } else {
      relojEl.textContent = `${formatearHoraMinutos(ahora)} — Semana ${info.semanaActual} del semestre`;
    }

    barraEl.style.width = `${info.porcentaje}%`;

    if (info.estado === "antes") {
      textoSemestreEl.textContent = `Faltan ${info.totalSemanas} semanas para el inicio.`;
    } else if (info.estado === "despues") {
      textoSemestreEl.textContent = `Semestre finalizado. Duró ${info.totalSemanas} semanas.`;
    } else {
      textoSemestreEl.textContent = `Progreso: ${info.porcentaje}% (${info.semanaActual}/${info.totalSemanas} semanas)`;
    }

    actualizarPreviewSemestre(info, cfg);
  }

  actualizar();
  if (!relojIntervalId) {
    relojIntervalId = setInterval(actualizar, 60 * 1000);
  }
}

// ===========================
// TOGGLE (accesible + cierre)
// ===========================
function configurarToggleSemestre() {
  const card = document.getElementById("semestreCard");
  const toggle = document.getElementById("semestreToggle");
  const detalle = document.getElementById("semestreDetalle");

  if (!card || !toggle || !detalle) return;

  // accesibilidad inicial
  toggle.setAttribute("aria-expanded", "false");
  detalle.setAttribute("aria-hidden", "true");

  // cerrar con botón
  let cerrarBtn = detalle.querySelector(".cerrar-modal");
  if (cerrarBtn) cerrarBtn.addEventListener("click", cerrarDetalle);

  function abrirDetalle() {
    card.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    detalle.setAttribute("aria-hidden", "false");
    const primerInput = detalle.querySelector("input, button, [tabindex]");
    if (primerInput) primerInput.focus();
  }

  function cerrarDetalle() {
    card.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    detalle.setAttribute("aria-hidden", "true");
    toggle.focus();
  }

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    const isOpen = card.classList.contains("is-open");
    if (isOpen) cerrarDetalle();
    else abrirDetalle();
  });

  // click en overlay para cerrar (solo si modal)
  detalle.addEventListener("click", (e) => {
    if (e.target === detalle) cerrarDetalle();
  });

  // ESC para cerrar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && card.classList.contains("is-open")) {
      cerrarDetalle();
    }
  });
}

// ===========================
// CLEANUP
// ===========================
function configurarLimpieza() {
  window.addEventListener("pagehide", () => {
    if (relojIntervalId) {
      clearInterval(relojIntervalId);
      relojIntervalId = null;
    }
  });
}

// ===========================
// INIT
// ===========================
document.addEventListener("DOMContentLoaded", () => {
  const alumno = cargarAlumnoDesdeStorage();
  if (!alumno) return;

  mostrarDatosAlumno(alumno);
  configurarLogout();
  mostrarConsejoDelDia();
  cargarClimaAlumno();

  cargarSemestreDesdeStorage();
  aplicarConfigEnFormulario();
  configurarFormularioSemestre();
  configurarToggleSemestre();
  iniciarRelojYProgreso();
  configurarLimpieza();
  cargarNoticias();
});
