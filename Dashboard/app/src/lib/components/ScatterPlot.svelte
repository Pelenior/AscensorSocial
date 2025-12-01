<script>
  import * as d3 from "d3";
  import { onMount, onDestroy } from "svelte";
  export let data = []; 
  export let title = "";

  let container;
  let svg, width, height, margin;

  function render() {
    if (!container) return;
    width = container.clientWidth;
    height = 360;
    margin = { top: 28, right: 16, bottom: 48, left: 64 };

    d3.select(container).selectAll("svg").remove();
    svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    if (!data || data.length === 0) return;

    const x = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.ingresos_padres))
      .nice()
      .range([0, innerW]);

    const y = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.ingresos_hijo))
      .nice()
      .range([innerH, 0]);

    const colorScale = d3.scaleLinear()
      .domain([0.6, 1, 1.4]) 
      .range(["tomato", "#e5e7eb", "steelblue"])
      .clamp(true);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x));

    g.append("g").call(d3.axisLeft(y));

    const pts = g.append("g").attr("opacity", 0.9);
    pts
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.ingresos_padres))
      .attr("cy", (d) => y(d.ingresos_hijo))
      .attr("fill", (d) => {
        const parentIncome = d.ingresos_padres || 1;
        const ratio = d.ingresos_hijo / parentIncome;
        return colorScale(ratio);
      })
      .attr("r", 3.5)
      .append("title")
      .text((d) => `Región: ${d.region}\nPadres: ${d.ingresos_padres}€\nHijo: ${d.ingresos_hijo}€`);

    g.append("text")
      .attr("x", 0)
      .attr("y", -8)
      .attr("font-weight", "600")
      .text(title);
  }

  function onResize() { render(); }

  $: data, render();

  onMount(() => {
    render();
    window.addEventListener("resize", onResize);
  });
  onDestroy(() => window.removeEventListener("resize", onResize));
</script>

<div bind:this={container} class="w-full"></div>