// js/alumno.js

document.addEventListener("DOMContentLoaded", () => {
  const registroForm = document.getElementById("registroForm");
  const loginForm = document.getElementById("loginForm");

  // ====================
  //      REGISTRO
  // ====================
  if (registroForm) {
    registroForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nombre = document.getElementById("nombre").value;
      const apellido = document.getElementById("apellido").value;
      const correo = document.getElementById("correo").value;
      const semestre = document.getElementById("semestre").value;
      const contraseña = document.getElementById("contraseña").value;

      try {
        const resp = await fetch("/.netlify/functions/alumnos/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, apellido, correo, semestre, contraseña }),
        });

        const data = await resp.json();
        alert(data.message || data.error || "Ocurrió un problema.");

        if (resp.ok) {
          registroForm.reset();
        }
      } catch (err) {
        console.error(err);
        alert("Error de conexión con el servidor.");
      }
    });
  }

  // ====================
  //        LOGIN
  // ====================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const correo = document.getElementById("loginCorreo").value;
      const contraseña = document.getElementById("loginContraseña").value;

      try {
        const resp = await fetch("/.netlify/functions/alumnos/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correo, contraseña }),
        });

        const data = await resp.json();

        if (!resp.ok || data.error) {
          alert(data.error || "Error al iniciar sesión.");
          return;
        }

        if (data.estado === "pendiente") {
          alert("Tu cuenta aún está PENDIENTE de aprobación por el administrador.");
          return;
        }

        // ===============================
        //   LOGIN CORRECTO → GUARDAR Y REDIRIGIR
        // ===============================
        const alumnoInfo = {
          id: data.id,
          nombre: data.nombre,
          apellido: data.apellido,
          correo: data.correo,
          semestre: data.semestre,
          estado: data.estado,
        };

        // Guardar sesión local (NO datos sensibles)
        localStorage.setItem("alumnoActual", JSON.stringify(alumnoInfo));

        alert(`Bienvenido ${data.nombre} ${data.apellido} 🎉`);

        // Ir al portal del alumno
        window.location.href = "alumno-panel.html";

      } catch (err) {
        console.error(err);
        alert("Error de conexión con el servidor.");
      }
    });
  }
});
