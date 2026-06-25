const express = require("express");
const path = require("path");
const axios = require("axios");
const { FLYCAR_BASE_URL, CITY_IDS } = require("./config");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

function normalizarNombreCiudad(nombre) {
  const mapa = {
    Bil: "Bilbao",
    BIL: "Bilbao",
    Bkl: "Barakaldo",
    BKL: "Barakaldo",
    Trl: "Torrelavega",
    TRL: "Torrelavega",
    Std: "Santander",
    STD: "Santander",
    Coa: "Costa de Eje",
    COA: "Costa de Eje"
  };

  return mapa[nombre] || nombre || "Sin ciudad";
}

function extraerRiders(data) {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }

  if (Array.isArray(data)) {
    if (Array.isArray(data[0]?.content)) return data[0].content;
    if (Array.isArray(data[0]?.riders)) return data[0].riders;
    return data;
  }

  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.riders)) return data.riders;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.content)) return data.data.content;
  if (Array.isArray(data?.data?.riders)) return data.data.riders;

  return [];
}

function procesarCiudad(nombre, riders) {
  let reparto = 0;
  let esperando = 0;
  let alertas = 0;

  const ridersProcesados = riders.map((rider) => {
    const status = String(rider.status || "").toLowerCase();
    const breakSeconds = rider?.performance?.time_spent?.break_seconds || 0;
    const lateSeconds = rider?.performance?.time_spent?.late_seconds || 0;

    const tienePedido = rider?.deliveries_info?.has_active_deliveries === true;

if (tienePedido) {
    reparto++;
} else if (status === "working") {
    esperando++;
} else {
    alertas++;
}

    if (breakSeconds > 600) alertas++;
    if (!rider.current_location?.latitude || !rider.current_location?.longitude) alertas++;

    return {
      id: rider.employee_id,
      nombre: rider.name || "RIDER",
      status,
      vehiculo: rider.vehicle?.name || "Sin vehículo",
      iconoVehiculo: rider.vehicle?.icon || "rider",
      lat: rider.current_location?.latitude || null,
      lng: rider.current_location?.longitude || null,
      descanso: breakSeconds,
      tarde: lateSeconds,
      pedidos: rider?.deliveries_info?.completed_deliveries_count || 0,
      balance: rider?.wallet_info?.balance || 0,
      zona: rider?.zone?.name || nombre
    };
  });

  return {
    nombre,
    reparto,
    esperando,
    alertas,
    riders: ridersProcesados
  };
}

app.get("/api/status", async (req, res) => {
  try {
    const respuestas = await Promise.all(
      CITY_IDS.map(async (cityId) => {
        const url = `${FLYCAR_BASE_URL}&city_id=${cityId}`;
        const respuesta = await axios.get(url);
        const riders = extraerRiders(respuesta.data);

        return riders.map((rider) => ({
          ...rider,
          city_id_consultado: cityId
        }));
      })
    );

    const todosLosRiders = respuestas.flat();
    const grupos = {};

    todosLosRiders.forEach((rider) => {
      const ciudadRaw =
        rider?.zone?.name ||
        rider?.starting_point?.starting_area_description ||
        rider?.starting_point?.name ||
        `City ${rider.city_id_consultado}`;

      const ciudad = normalizarNombreCiudad(ciudadRaw);

      if (!grupos[ciudad]) grupos[ciudad] = [];
      grupos[ciudad].push(rider);
    });

    const ciudades = Object.entries(grupos).map(([nombre, ridersCiudad]) =>
      procesarCiudad(nombre, ridersCiudad)
    );

    res.json({
      actualizado: new Date(),
      total_riders: todosLosRiders.length,
      ciudades
    });
  } catch (error) {
    console.error("Error conectando con Flycar:", error.message);

    res.status(500).json({
      error: "No se pudo conectar con Flycar",
      detalle: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.clear();
  console.log("======================================");
  console.log("      RICREP CONTROL CENTER V4");
  console.log("======================================");
  console.log(`Servidor iniciado: http://localhost:${PORT}`);
  console.log("======================================");
});