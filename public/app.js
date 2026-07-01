console.log("Dashboard conectado al servidor");

let alarmaActiva = false;
let alarmaSilenciada = false;
let ultimaFirmaAlertas = "";
let ciudadesYaAvisadas = [];

let mapa;
let marcadores = [];

const centrosCiudad = {
  Bilbao: [43.263, -2.935],
  Barakaldo: [43.296, -2.987],
  Santander: [43.462, -3.809],
  Torrelavega: [43.349, -4.047],
  "Costa de Eje": [43.300, -2.250]
};

const audio = new Audio("/alert.mp3");
audio.loop = false;

async function cargarDatos() {
  try {
    const respuesta = await fetch("/api/status");
    const data = await respuesta.json();

pintarDashboard(data.ciudades);
revisarAlertas(data.ciudades);
pintarListaAlertas(data.ciudades);
actualizarMapa(data.ciudades);
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

const tieneDescanso = (ciudad.riders || []).some(r => r.descanso > 600);

const tieneNoCheckIn = (ciudad.riders || []).some(r => {
  const status = String(r.status || "").toLowerCase();

  return (
    !status ||
    status === "not_checked_in" ||
    status === "no_check_in" ||
    status === "offline" ||
    status === "inactive"
  );
});

let mensaje = `Alerta. ${ciudad.nombre}.`;

if (tieneNoCheckIn && tieneDescanso) {
  mensaje = `Alerta. ${ciudad.nombre}. No check-in y rider en descanso.`;
} else if (tieneNoCheckIn) {
  mensaje = `Alerta. ${ciudad.nombre}. No check-in.`;
} else if (tieneDescanso) {
  mensaje = `Alerta. ${ciudad.nombre}. Rider en descanso.`;
}

const voz = new SpeechSynthesisUtterance(mensaje);
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
inicializarMapa();
cargarDatos();

setInterval(actualizarReloj, 1000);
setInterval(cargarDatos, 5000);
function obtenerTodosLosRiders(ciudades) {
  return ciudades.flatMap(ciudad =>
    (ciudad.riders || []).map(rider => ({
      ...rider,
      ciudad: ciudad.nombre
    }))
  );
}

function clasificarRider(rider) {
  const status = String(rider.status || "").toLowerCase();

  if (
    !status ||
    status === "not_checked_in" ||
    status === "no_check_in" ||
    status === "offline" ||
    status === "inactive"
  ) {
    return "noCheckIn";
  }

  if (
    status === "starting" ||
    status === "checking_in" ||
    status === "connecting"
  ) {
    return "empezando";
  }

  if (
    status === "ending" ||
    status === "finishing"
  ) {
    return "finalizando";
  }

  if (rider.descanso > 600) {
    return "descanso";
  }

  if (rider.pedidos > 0) {
    return "reparto";
  }

  if (status === "working") {
    return "esperando";
  }

  return "esperando";
}

function pintarListaAlertas(ciudades) {
  const lista = document.getElementById("listaAlertas");
  const riders = obtenerTodosLosRiders(ciudades);

  const grupos = {
    noCheckIn: {
      titulo: "🔴 NO CHECK-IN",
      riders: []
    },
    empezando: {
      titulo: "🟠 EMPEZANDO TURNO",
      riders: []
    },
    finalizando: {
      titulo: "🟡 FINALIZANDO TURNO",
      riders: []
    },
    descanso: {
      titulo: "🔵 EN DESCANSO",
      riders: []
    },
    reparto: {
      titulo: "🟢 EN REPARTO",
      riders: []
    },
    esperando: {
      titulo: "⚪ ESPERANDO PEDIDO",
      riders: []
    }
  };

  riders.forEach(rider => {
    const categoria = clasificarRider(rider);
    grupos[categoria].riders.push(rider);
  });

  lista.innerHTML = "";

  Object.values(grupos).forEach(grupo => {
    if (grupo.riders.length === 0) return;

    const bloque = document.createElement("div");
    bloque.className = "alert-group";

    bloque.innerHTML = `
      <h4>${grupo.titulo} <span>${grupo.riders.length}</span></h4>
      ${grupo.riders.map(rider => `
        <div class="rider-row">
          <strong>ID ${rider.id || "Sin ID"}</strong>
          <span>${rider.nombre || "Rider"}</span>
          <small>${rider.ciudad || "Sin ciudad"} · ${rider.status || "Sin estado"}</small>
        </div>
      `).join("")}
    `;

    lista.appendChild(bloque);
  });

  if (lista.innerHTML.trim() === "") {
    lista.innerHTML = "<p>Sin riders activos en este momento.</p>";
  }
}function inicializarMapa() {
  if (!document.getElementById("map")) return;

  mapa = L.map("map").setView([43.263, -2.935], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapa);
}

function actualizarMapa(ciudades) {
  if (!mapa) return;

  marcadores.forEach(marker => marker.remove());
  marcadores = [];

  const riders = ciudades.flatMap(ciudad =>
    (ciudad.riders || []).map(rider => ({
      ...rider,
      ciudad: ciudad.nombre
    }))
  );

  riders.forEach(rider => {
    if (!rider.lat || !rider.lng) return;

    const marker = L.marker([rider.lat, rider.lng]).addTo(mapa);

    marker.bindPopup(`
      <strong>ID ${rider.id || "Sin ID"}</strong><br>
      ${rider.nombre || "Rider"}<br>
      Ciudad: ${rider.ciudad || "Sin ciudad"}<br>
      Estado: ${rider.status || "Sin estado"}<br>
      Vehículo: ${rider.vehiculo || "Sin vehículo"}<br>
      Pedidos: ${rider.pedidos || 0}
    `);

    marcadores.push(marker);
  });

  }

function inicializarMapa() {
  if (!document.getElementById("map")) return;

  mapa = L.map("map").setView([43.263, -2.935], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapa);
}

window.centrarCiudad = function(nombre) {
  if (!mapa || !centrosCiudad[nombre]) return;

  mapa.flyTo(centrosCiudad[nombre], 13, {
    animate: true,
    duration: 1.2
  });
};