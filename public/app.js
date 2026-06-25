console.log("Dashboard conectado al servidor");

let alarmaActiva = false;
let alarmaSilenciada = false;
let ultimaFirmaAlertas = "";
let ciudadesYaAvisadas = [];

const audio = new Audio("/alert.mp3");
audio.loop = false;

async function cargarDatos() {
  try {
    const respuesta = await fetch("/api/status");
    const data = await respuesta.json();

    pintarDashboard(data.ciudades);
    revisarAlertas(data.ciudades);
    actualizarUltimaConexion(data.actualizado);

  } catch (error) {
    console.error("Error cargando datos:", error);
  }
}

function pintarDashboard(ciudades) {
  const dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = "";

  let totalReparto = 0;
  let totalEsperando = 0;
  let totalAlertas = 0;

  ciudades.forEach(ciudad => {
    totalReparto += ciudad.reparto;
    totalEsperando += ciudad.esperando;
    totalAlertas += ciudad.alertas;

    const tieneAlerta = ciudad.alertas > 0;

    const card = document.createElement("div");
    card.className = tieneAlerta ? "city alerta" : "city";

    card.innerHTML = `
      <span class="status ${tieneAlerta ? "alerta-label" : "operativo"}">
        ${tieneAlerta ? "ALERTA" : "OPERATIVO"}
      </span>

      <h2>${ciudad.nombre.toUpperCase()}</h2>

      <div class="metric">
        <span>Reparto</span>
        <strong class="green">${ciudad.reparto}</strong>
      </div>

      <div class="metric">
        <span>Esperando</span>
        <strong class="yellow">${ciudad.esperando}</strong>
      </div>

      <div class="metric">
        <span>Alertas</span>
        <strong class="red">${ciudad.alertas}</strong>
      </div>
    `;

    dashboard.appendChild(card);
  });

  document.getElementById("totalReparto").textContent = totalReparto;
pintarListaAlertas(ciudades);
  document.getElementById("totalEsperando").textContent = totalEsperando;
  document.getElementById("totalAlertas").textContent = totalAlertas;
}

function revisarAlertas(ciudades) {
  const ciudadesConAlerta = ciudades.filter(ciudad => ciudad.alertas > 0);
  const totalAlertas = ciudadesConAlerta.reduce((t, c) => t + c.alertas, 0);
  const banner = document.getElementById("bannerAlerta");

  const nombresActivos = ciudadesConAlerta.map(c => c.nombre);

  ciudadesYaAvisadas = ciudadesYaAvisadas.filter(nombre =>
    nombresActivos.includes(nombre)
  );

  if (totalAlertas > 0) {
    banner.classList.remove("oculto");

    ciudadesConAlerta.forEach((ciudad, index) => {
      if (!alarmaSilenciada && !ciudadesYaAvisadas.includes(ciudad.nombre)) {
        ciudadesYaAvisadas.push(ciudad.nombre);

        setTimeout(() => {
          audio.currentTime = 0;
          audio.play().catch(() => {});

          const voz = new SpeechSynthesisUtterance(`Alerta. ${ciudad.nombre}.`);
          voz.lang = "es-ES";
          voz.rate = 0.95;
          voz.pitch = 1;
          speechSynthesis.speak(voz);
        }, index * 1500);
      }
    });

    alarmaActiva = true;
  } else {
    banner.classList.add("oculto");
    alarmaSilenciada = false;
    alarmaActiva = false;
    ciudadesYaAvisadas = [];
    ultimaFirmaAlertas = "";
    audio.pause();
    audio.currentTime = 0;
    speechSynthesis.cancel();
  }
}

function detenerAlarma() {
  alarmaSilenciada = true;
  alarmaActiva = false;
  audio.pause();
  audio.currentTime = 0;
}

function actualizarReloj() {
  const ahora = new Date();
  document.getElementById("hora").textContent = ahora.toLocaleTimeString("es-ES");
  document.getElementById("fecha").textContent = ahora.toLocaleDateString("es-ES");
}

function actualizarUltimaConexion(fecha) {
  console.log("Última actualización:", fecha);
}

document.getElementById("silenciar").addEventListener("click", detenerAlarma);

actualizarReloj();
cargarDatos();

setInterval(actualizarReloj, 1000);
setInterval(cargarDatos, 5000);
function pintarListaAlertas(ciudades) {
  const lista = document.getElementById("listaAlertas");
  const alertas = ciudades.filter(c => c.alertas > 0);

  if (alertas.length === 0) {
    lista.innerHTML = "<p>Sin alertas críticas.</p>";
    return;
  }

  lista.innerHTML = "";

  alertas.forEach(ciudad => {
    const item = document.createElement("div");
    item.className = "alert-item";

    item.innerHTML = `
      <strong>${ciudad.nombre.toUpperCase()}</strong>
      <small>${ciudad.alertas} incidencia activa · revisar operación</small>
    `;

    lista.appendChild(item);
  });
}