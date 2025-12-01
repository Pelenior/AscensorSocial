<script>
  import { onMount } from "svelte";
  import { getSummary, getPoints } from "./lib/api";
  import BarChart from "./lib/components/BarChart.svelte";
  import ScatterPlot from "./lib/components/ScatterPlot.svelte";

  let loading = true;
  let error = "";
  let summary = null;
  let points = [];

  onMount(async () => {
    try {
      summary = await getSummary();
      points = await getPoints();
    } catch (e) {
      error = e.message || "Error cargando datos";
    } finally {
      loading = false;
    }
  });
</script>

<div class="max-w-6xl mx-auto p-6 space-y-6">
  <header class="flex items-end justify-between">
    <div>
      <h1 class="text-2xl font-bold">Ascensor Social — Dashboard</h1>
      <p class="text-slate-600">
        Svelte + D3 + Tailwind
      </p>
    </div>
  </header>

  {#if loading}
    <div class="animate-pulse text-slate-500">Cargando datos...</div>
  {:else if error}
    <div class="text-red-600">⚠ {error}</div>
  {:else}
    <section class="grid md:grid-cols-3 gap-4">
      <div class="bg-white p-4 rounded-2xl shadow">
        <div class="text-slate-500 text-sm">muestras (simuladas)</div>
        <div class="text-3xl font-semibold">{summary.n}</div>
      </div>
  
      <div class="bg-white p-4 rounded-2xl shadow">
        <div class="text-slate-500 text-sm mb-2">
          correlación (ingresos padres-hijo)
        </div>
        <div class="flex items-center gap-4">
          <div class="text-3xl font-semibold">{summary.corr}</div>
        </div>
      </div>

      <div class="bg-white p-4 rounded-2xl shadow">
        <div class="text-slate-500 text-sm">regiones</div>
        <div class="text-3xl font-semibold">
          {summary.regionMobility.length}
        </div>
      </div>
    </section>

    <section class="grid md:grid-cols-2 gap-6">
      <div class="bg-white p-4 rounded-2xl shadow">
        <BarChart
          title="Índice simple de movilidad por región"
          data={summary.regionMobility.map((d) => ({
            label: d.region,
            value: d.movilidad,
          }))}
        />
      </div>

      <div class="bg-white p-4 rounded-2xl shadow">
        <ScatterPlot
          title="Ingresos: padres vs hijo (con regresión)"
          data={points}
        />
      </div>
    </section>

    <footer class="text-sm text-slate-500 mt-10 border-t pt-6">
      <p class="font-semibold mb-2">Datos generados a partir de los archivos:</p>
      <ul class="font-mono text-xs space-y-1">
        <li>1. ranking_ccaa_centil_padres_20.csv</li>
        <li>2. distribucion_quintiles_nacional_padres_hijos.csv</li>
        <li>3. conversor_centiles_a_euros_padres.csv</li>
        <li>4. conversor_centiles_a_euros_hijos.csv</li>
      </ul>
    </footer>
  {/if}
</div>