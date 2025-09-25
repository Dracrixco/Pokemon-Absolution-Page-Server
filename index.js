const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
// screen -S backend -X quit
// screen -dmS backend node index.js
const app = express();
const PORT = 4000;

// Enlace de descarga directo de Google Drive
const DOWNLOAD_LINK = [
  {
    url: "https://drive.google.com/file/d/1nzhjHyIZ1ydZ4VTy-di4tQ3n2JdT84Fy/view?usp=sharing",
    from: "Google Drive",
  },
  {
    url: "http://www.mediafire.com/file/9dkqal0n3i06j97/Absolution_%28v0.1.5b%29.zip",
    from: "MediaFire",
  },
];

// Archivo donde guardamos los logs
const LOG_FILE = path.join(__dirname, "downloads.json");
const UPDATES_FILE = path.join(__dirname, "updates.json");

app.use(cors());

// Función para obtener la información de la última actualización
function getLatestUpdateInfo() {
  const updates = loadUpdates();
  if (updates.length === 0) {
    return {
      version: "v0.1.0",
      date: "2025-01-01",
    };
  }

  // Ordenar por fecha más reciente (asumiendo formato YYYY-MM-DD)
  const sortedUpdates = updates.sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  const latestUpdate = sortedUpdates[0];

  return {
    version: latestUpdate.version,
    date: latestUpdate.date,
  };
}

// Función para verificar si una actualización es nueva (menos de 3 días)
function isUpdateNew(dateString) {
  const updateDate = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - updateDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
}

// Función para formatear fecha
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Función para cargar updates del archivo JSON
function loadUpdates() {
  if (!fs.existsSync(UPDATES_FILE)) {
    console.error("Archivo updates.json no encontrado");
    return [];
  }

  try {
    const raw = fs.readFileSync(UPDATES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error leyendo updates.json:", err);
    return [];
  }
}

app.get("/api/download", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const country = req.headers["cf-ipcountry"] || "UNKNOWN";
  const time = new Date().toISOString();

  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    const raw = fs.readFileSync(LOG_FILE, "utf-8").trim();
    if (raw.length > 0) {
      try {
        logs = JSON.parse(raw);
      } catch (err) {
        console.error("Error leyendo el log:", err);
      }
    }
  }

  logs.push({ time, ip, country });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

  console.log(`⬇️  Descarga registrada: ${ip} (${country})`);

  // 🔁 Redirige al enlace de Google Drive
  res.redirect(GOOGLE_DRIVE_URL);
});

// Nueva ruta para obtener información del juego
app.get("/api/game-info", (req, res) => {
  const latestInfo = getLatestUpdateInfo();

  res.json({
    downloadLink: DOWNLOAD_LINK,
    lastUpdated: formatDate(latestInfo.date),
    latestInfo: latestInfo.version,
  });
});

// Nueva ruta para obtener todas las actualizaciones
app.get("/api/updates", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const updates = loadUpdates();

  // Añadir información adicional a cada update
  const updatesWithMeta = updates.map((update) => ({
    ...update,
    isNew: isUpdateNew(update.date),
    formattedDate: formatDate(update.date),
  }));

  // Si se solicita paginación
  if (req.query.page || req.query.limit) {
    const paginatedUpdates = updatesWithMeta.slice(startIndex, endIndex);
    const hasMore = endIndex < updatesWithMeta.length;
    const totalPages = Math.ceil(updatesWithMeta.length / limit);

    return res.json({
      updates: paginatedUpdates,
      pagination: {
        currentPage: page,
        totalPages,
        totalUpdates: updatesWithMeta.length,
        hasMore,
        limit,
      },
    });
  }

  // Si no se solicita paginación, devolver todas
  res.json(updatesWithMeta);
});

// Nueva ruta para obtener una actualización específica por ID
app.get("/api/updates/:id", (req, res) => {
  const updates = loadUpdates();
  const update = updates.find((u) => u.id === req.params.id);

  if (!update) {
    return res.status(404).json({ error: "Actualización no encontrada" });
  }

  res.json({
    ...update,
    isNew: isUpdateNew(update.date),
    formattedDate: formatDate(update.date),
  });
});

app.get("/api/countries", (req, res) => {
  if (!fs.existsSync(LOG_FILE)) {
    return res.status(200).json({
      countries: {},
      totalDownloads: 0,
    });
  }

  const raw = fs.readFileSync(LOG_FILE, "utf-8").trim();
  if (!raw)
    return res.status(200).json({
      countries: {},
      totalDownloads: 0,
    });

  let logs;
  try {
    logs = JSON.parse(raw);
  } catch (err) {
    return res.status(500).json({ error: "Error leyendo el log" });
  }

  const countryCount = {};

  for (const log of logs) {
    const country = log.country || "UNKNOWN";
    countryCount[country] = (countryCount[country] || 0) + 1;
  }

  const sorted = Object.entries(countryCount)
    .sort((a, b) => b[1] - a[1]) // Orden descendente
    .reduce((obj, [country, count]) => {
      obj[country] = count;
      return obj;
    }, {});

  res.json({
    countries: sorted,
    totalDownloads: logs.length,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  const latestInfo = getLatestUpdateInfo();
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
  console.log(`Versión actual: ${latestInfo.version} (${latestInfo.date})`);
});
