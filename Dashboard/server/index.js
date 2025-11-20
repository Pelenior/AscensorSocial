import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// Metodo de carga del CSV
async function cargarCSV() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  try {
    // Path del csv
    const csvPath = path.join(__dirname, '..', 'data', 'ascensor_social.csv');
    const fileContent = await fs.readFile(csvPath, 'utf-8');
    const lines = fileContent.trim().split('\n');
    const header = lines.shift().split(',').map(h => h.trim());

    // Control de errores por si faltan columnas
    const requiredColumns = ['region', 'ingresos_padres', 'ingresos_hijo'];
    if (!requiredColumns.every(col => header.includes(col))) {
      throw new Error(`El archivo CSV debe contener las columnas: ${requiredColumns.join(', ')}. Columnas encontradas: ${header.join(', ')}`);
    }

    const data = lines.map((line, index) => {
      const values = line.split(',');
      const entry = { id: index + 1 };
      header.forEach((key, i) => {
        const value = values[i] ? values[i].trim() : '';
        if (key === 'ingresos_padres' || key === 'ingresos_hijo') {
          entry[key] = parseFloat(value) || 0;
        } else {
          entry[key] = value;
        }
      });
      return entry;
    });
    console.log(`Loaded ${data.length} records from CSV.`);
    return data;
  } catch (error) {
    // Devuelve un array vacío si hay un error
    console.error("Error loading data from CSV:", error);
    return [];
  }
}

// Helpers
function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy; dx += vx * vx; dy += vy * vy;
  }
  return num / Math.sqrt(dx * dy);
}

function mobilityIndex(p, c) {
  // 1 - |delta|/p (clamped >=0). Higher is "better" (less inheritance)
  return Math.max(0, 1 - Math.abs(c - p) / Math.max(1, p));
}

async function startServer() {
  const DB = await cargarCSV();

  // --- API ---
  app.get('/api/v1/points', (req, res) => {
    if (!DB || DB.length === 0) {
      return res.status(500).json({ error: "Data not loaded or empty." });
    }
    // optional limit
    const limit = Math.min(Number(req.query.limit) || 500, 2000);
    const sample = DB.slice(0, limit);
    res.json(sample);
  });

  app.get('/api/v1/summary', (req, res) => {
    if (!DB || DB.length === 0) {
      return res.status(500).json({ error: "Data not loaded or empty." });
    }
    const xs = DB.map(d => d.ingresos_padres);
    const ys = DB.map(d => d.ingresos_hijo);
    const corr = pearson(xs, ys);

    const byRegion = {};
    DB.forEach(d => {
      const m = mobilityIndex(d.ingresos_padres, d.ingresos_hijo);
      if (!byRegion[d.region]) byRegion[d.region] = { count: 0, sumMob: 0 };
      byRegion[d.region].count += 1;
      byRegion[d.region].sumMob += m;
    });
    const regionMobility = Object.entries(byRegion)
      .map(([region, obj]) => ({
        region,
        movilidad: Number((obj.sumMob / obj.count).toFixed(3))
      }))
      .sort((a, b) => b.movilidad - a.movilidad);

    res.json({
      n: DB.length,
      corr: Number(corr.toFixed(3)),
      regionMobility
    });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

startServer();
