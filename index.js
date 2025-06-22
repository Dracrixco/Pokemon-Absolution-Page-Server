const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 4000;

// Enlace de descarga directo de Google Drive
const GOOGLE_DRIVE_URL =
  "https://drive.google.com/file/d/1cT0m04sBDGL6U8xqznVomvbMBKAiyI8q/view?usp=drive_link";

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

app.listen(PORT, () => {
  console.log(`✅ Servidor de descargas corriendo en http://localhost:${PORT}`);
});
