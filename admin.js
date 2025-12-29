// js/admin.js

let noticiaEditandoId = null; // null = modo crear, número = modo edición

document.addEventListener("DOMContentLoaded", () => {
  const formAdminLogin = document.getElementById("form-admin-login");

  // ============================
  // LOGIN ADMIN (simulado)
  // ============================
  if (formAdminLogin) {
    formAdminLogin.addEventListener("submit", (e) => {
      e.preventDefault();

      const usuario = document.getElementById("admin-usuario").value;
      const password = document.getElementById("admin-password").value;

      if (usuario === "admin" && password === "1234") {
        localStorage.setItem("adminLogueado", "true");
        alert("Login correcto. Bienvenido, administrador.");
        window.location.href = "admin-panel.html";
      } else {
        alert("Usuario o contraseña incorrectos).");
      }
    });
  }

  // ============================
  // LÓGICA DEL PANEL ADMIN
  // ============================
  if (window.location.pathname.endsWith("admin-panel.html")) {
    const logueado = localStorage.getItem("adminLogueado");
    if (logueado !== "true") {
      alert("No tienes sesión de administrador. Inicia sesión primero.");
      window.location.href = "admin-login.html";
      return;
    }

    const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");
    if (btnCerrarSesion) {
      btnCerrarSesion.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("adminLogueado");
        alert("Sesión cerrada.");
        window.location.href = "admin-login.html";
      });
    }

    // ----------- FORM NOTICIA -----------
    const formNoticia = document.getElementById("form-nueva-noticia");
    const tituloInput = document.getElementById("titulo-noticia");
    const contenidoInput = document.getElementById("contenido-noticia");
    const contNoticias = document.getElementById("tabla-noticias");

    if (formNoticia) {
      formNoticia.addEventListener("submit", async (e) => {
        e.preventDefault();
        const titulo = tituloInput.value.trim();
        const contenido = contenidoInput.value.trim();

        if (!titulo || !contenido) {
          alert("Completá título y contenido.");
          return;
        }

        try {
          // Si hay ID en noticiaEditandoId => EDITAR (PUT)
          if (noticiaEditandoId !== null) {
            const resp = await fetch(
              `/.netlify/functions/posts?id=${noticiaEditandoId}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ titulo, contenido }),
              }
            );

            const data = await resp.json();

            if (!resp.ok) {
              alert(data.error || "Error al actualizar la noticia");
              return;
            }

            alert("Noticia actualizada correctamente.");
            noticiaEditandoId = null;
            formNoticia.reset();
            formNoticia.querySelector("button[type='submit']").textContent =
              "Publicar noticia";
            // Recargar listado
            cargarNoticias();
          } else {
            // Modo CREAR (POST)
            const resp = await fetch("/.netlify/functions/posts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                titulo,
                contenido,
                tipo: "noticia",
              }),
            });

            const data = await resp.json();

            if (!resp.ok) {
              alert(data.error || "Error al crear la noticia");
              return;
            }

            alert("Noticia creada correctamente en la base de datos.");
            formNoticia.reset();
            // Recargar listado
            cargarNoticias();
          }
        } catch (err) {
          console.error(err);
          alert("Error de conexión con el servidor.");
        }
      });
    }

    // Cargar noticias existentes al abrir el panel
    if (contNoticias) {
      cargarNoticias();
    }

    // --- ALUMNOS PENDIENTES ---
    cargarAlumnosPendientes();
  }
});

//
// =====================================
// NOTICIAS EXISTENTES (CRUD) - PANEL
// =====================================
//

async function cargarNoticias() {
  const cont = document.getElementById("tabla-noticias");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando noticias...</p>";

  try {
    const resp = await fetch("/.netlify/functions/posts?tipo=noticia");
    const noticias = await resp.json();

    if (!resp.ok) {
      cont.innerHTML = "<p>Error al cargar noticias.</p>";
      return;
    }

    if (!Array.isArray(noticias) || noticias.length === 0) {
      cont.innerHTML = "<p>No hay noticias publicadas.</p>";
      return;
    }

    const filas = noticias
      .map((n) => {
        const fecha = n.creado_en ? new Date(n.creado_en) : null;
        const fechaStr = fecha
          ? fecha.toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        return `
          <tr>
            <td>${n.id}</td>
            <td>${escapeHtml(n.titulo)}</td>
            <td>${fechaStr}</td>
            <td>
              <button class="btn-editar-noticia" data-id="${n.id}" data-titulo="${encodeURIComponent(
          n.titulo
        )}" data-contenido="${encodeURIComponent(
          n.contenido
        )}">Editar</button>
              <button class="btn-eliminar-noticia" data-id="${n.id}">Eliminar</button>
            </td>
          </tr>
        `;
      })
      .join("");

    cont.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
      </table>
    `;

    // Listeners de acciones
    cont.querySelectorAll(".btn-editar-noticia").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        const titulo = decodeURIComponent(btn.getAttribute("data-titulo"));
        const contenido = decodeURIComponent(
          btn.getAttribute("data-contenido")
        );

        const tituloInput = document.getElementById("titulo-noticia");
        const contenidoInput = document.getElementById("contenido-noticia");
        const formNoticia = document.getElementById("form-nueva-noticia");

        if (!tituloInput || !contenidoInput || !formNoticia) return;

        noticiaEditandoId = id;
        tituloInput.value = titulo;
        contenidoInput.value = contenido;

        formNoticia.querySelector("button[type='submit']").textContent =
          "Guardar cambios";

        formNoticia.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    cont.querySelectorAll(".btn-eliminar-noticia").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-id"));
        if (!confirm(`¿Seguro que deseas eliminar la noticia ${id}?`)) return;

        try {
          const resp = await fetch(`/.netlify/functions/posts?id=${id}`, {
            method: "DELETE",
          });

          const data = await resp.json().catch(() => ({}));

          if (!resp.ok) {
            alert(data.error || "Error al eliminar la noticia");
            return;
          }

          alert("Noticia eliminada correctamente.");
          cargarNoticias();
        } catch (err) {
          console.error(err);
          alert("Error de conexión al eliminar.");
        }
      });
    });
  } catch (err) {
    console.error(err);
    cont.innerHTML = "<p>Error al cargar noticias.</p>";
  }
}

// Sanear texto para evitar HTML raro
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

//
// =====================================
// ALUMNOS PENDIENTES (ya lo tenías)
// =====================================
//

async function cargarAlumnosPendientes() {
  const cont = document.getElementById("lista-alumnos-pendientes");
  if (!cont) return;

  cont.innerHTML = "<p>Cargando alumnos...</p>";

  try {
    const resp = await fetch("/.netlify/functions/alumnos/pendientes");
    const alumnos = await resp.json();

    if (!resp.ok) {
      cont.innerHTML = "<p>Error al cargar alumnos.</p>";
      return;
    }

    if (alumnos.length === 0) {
      cont.innerHTML = "<p>No hay alumnos pendientes.</p>";
      return;
    }

    const tabla = document.createElement("table");
    tabla.classList.add("admin-table");
    tabla.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Semestre</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${alumnos
          .map(
            (a) => `
          <tr>
            <td>${a.id}</td>
            <td>${a.nombre} ${a.apellido}</td>
            <td>${a.correo}</td>
            <td>${a.semestre}</td>
            <td>
              <button data-id="${a.id}" class="btn-aprobar">Aprobar</button>
              <button data-id="${a.id}" class="btn-eliminar">Eliminar</button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    `;

    cont.innerHTML = "";
    cont.appendChild(tabla);

    // Listeners para los botones
    cont.querySelectorAll(".btn-aprobar").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        accionAlumno("aprobar", id);
      });
    });

    cont.querySelectorAll(".btn-eliminar").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        accionAlumno("eliminar", id);
      });
    });
  } catch (err) {
    console.error(err);
    cont.innerHTML = "<p>Error al cargar alumnos.</p>";
  }
}

async function accionAlumno(accion, id) {
  if (!confirm(`¿Seguro que deseas ${accion} al alumno ${id}?`)) return;

  try {
    const resp = await fetch(`/.netlify/functions/alumnos/${accion}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(id) }),
    });

    const data = await resp.json();
    alert(data.message || data.error || "Operación realizada.");

    // Volver a recargar la tabla
    cargarAlumnosPendientes();
  } catch (err) {
    console.error(err);
    alert("Error al realizar la operación.");
  }
}
