import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

async function cargarCSV(fileName) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  try {
    const csvPath = path.join(__dirname, '..', 'data', fileName);
    let fileContent = await fs.readFile(csvPath, 'utf-8');
    
    fileContent = fileContent.replace(/^\uFEFF/, "");

    const lines = fileContent.trim().replace(/\r/g, "").split('\n');
    const header = lines.shift().split(',').map(h => h.trim());

    return lines.map((line, index) => {
      const values = line.split(',');
      const entry = {};
      
      header.forEach((key, i) => {
        const cleanKey = key.trim();
        const valString = values[i] ? values[i].trim() : ''; 

        const num = Number(valString);
        
        if (valString !== '' && !isNaN(num)) {
          entry[cleanKey] = num;
        } else {
          entry[cleanKey] = valString;
        }
      });
      return entry;
    });
  } catch (error) {
    console.error(`Error loading ${fileName}:`, error);
    return [];
  }
}

let seed = 12345; 
function seededRandom() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function processConverters(rawRows) {
  const map = {};
  const counts = {};
  rawRows.forEach(row => {
    const c = row.centil;
    const r = row.renta;
    if (typeof c === 'undefined' || typeof r === 'undefined') return;
    if (!map[c]) { map[c] = 0; counts[c] = 0; }
    map[c] += r;
    counts[c] += 1;
  });
  const finalMap = {};
  for (let c = 1; c <= 100; c++) {
    if (map[c]) finalMap[c] = map[c] / counts[c];
    else finalMap[c] = 0;
  }
  return finalMap;
}

function generateSimulatedPoints(matrix, convPadres, convHijos, totalPoints = 2000) {
  seed = 12345; 
  
  const quintileKeys = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  const points = [];

  if (!matrix || matrix.length === 0) {
    console.error("Critical Error: Matrix data is empty.");
    return [];
  }

  for (let i = 0; i < totalPoints; i++) {
    const pQuintilIdx = Math.floor(seededRandom() * 5);
    const pQuintileName = quintileKeys[pQuintilIdx];
    
    const row = matrix.find(r => r.quintil_padres === pQuintileName);
    
    if (!row) continue;
    
    const rand = seededRandom() * 100;
    let accum = 0;
    let cQuintilIdx = 0;
    
    for (let k = 0; k < quintileKeys.length; k++) {
      const key = quintileKeys[k];
      accum += (row[key] || 0);
      if (rand <= accum) {
        cQuintilIdx = k;
        break;
      }
    }

    const pCentil = (pQuintilIdx * 20) + Math.floor(seededRandom() * 20) + 1;
    const cCentil = (cQuintilIdx * 20) + Math.floor(seededRandom() * 20) + 1;

    points.push({
      ingresos_padres: convPadres[pCentil] || 0,
      ingresos_hijo: convHijos[cCentil] || 0,
      region: 'Nacional'
    });
  }
  return points;
}

function pearson(data) {
  const n = data.length;
  if (n === 0) return 0;
  const xs = data.map(d => d.ingresos_padres);
  const ys = data.map(d => d.ingresos_hijo);
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

// --- SERVIDOR ---

async function startServer() {
  const DATASETS = {};

  console.log("Loading datasets...");

  const [ranking, matrix, rawConvP, rawConvH] = await Promise.all([
    cargarCSV('ranking_ccaa_centil_padres_20.csv'),
    cargarCSV('distribucion_quintiles_nacional_padres_hijos.csv'),
    cargarCSV('conversor_centiles_a_euros_padres.csv'),
    cargarCSV('conversor_centiles_a_euros_hijos.csv')
  ]);

  const convPadres = processConverters(rawConvP);
  const convHijos = processConverters(rawConvH);
  
  const simulatedPoints = generateSimulatedPoints(matrix, convPadres, convHijos, 1000);
  
  console.log(`Simulated ${simulatedPoints.length} points (Deterministic).`);
  console.log(`Loaded ${ranking.length} regions for Bar Chart.`);

  DATASETS['ranking'] = ranking;
  DATASETS['points'] = simulatedPoints;

  // --- API ---

  app.get('/api/v1/points', (req, res) => {
    res.json(DATASETS['points']);
  });

  app.get('/api/v1/summary', (req, res) => {
    const points = DATASETS['points'];
    const rankingData = DATASETS['ranking'];

    const corr = pearson(points);

    const regionMobility = rankingData.map(d => ({
      region: d.ccaa,
      movilidad: d.centil_hijo_loess / 100 
    })).sort((a, b) => b.movilidad - a.movilidad);

    res.json({
      n: points.length,
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