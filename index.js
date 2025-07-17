const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
// screen -S backend -X quit
// screen -dmS backend node index.js
const app = express();
const PORT = 4000;

// Enlace de descarga directo de Google Drive
const GOOGLE_DRIVE_URL =
  "https://drive.google.com/file/d/1tXJWHUOU_iRogieah9w1ShQ05dMWMWWg/view?usp=drive_link";

const VERSION_NAME = "0.1.3";
const LAST_UPDATED = "2025-06-18"; // Year - Month - Day (-1)

// Archivo donde guardamos los logs
const LOG_FILE = path.join(__dirname, "downloads.json");

app.use(cors());

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
  res.json({
    version: VERSION_NAME,
    downloadLink: GOOGLE_DRIVE_URL,
    lastUpdated: LAST_UPDATED,
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
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
