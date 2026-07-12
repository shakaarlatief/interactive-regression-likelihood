(function () {
    "use strict";

    const COLORS = Object.freeze({
        navy: "#0F172A",
        slate: "#475569",
        muted: "#64748B",
        border: "#D8E1EC",
        grid: "rgba(148, 163, 184, 0.22)",
        blue: "#1D4ED8",
        teal: "#0891B2",
        amber: "#D97706",
        red: "#DC2626",
        white: "#FFFFFF"
    });

    const TRUE_MODEL = Object.freeze({ beta0: 1.2, beta1: 0.75, sigma: 1.1 });
    const X_GRID = Object.freeze(Array.from({ length: 91 }, (_, index) => 0.5 + index * 0.1));
    const PLOT_CONFIG = Object.freeze({
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        modeBarButtonsToRemove: ["lasso2d", "select2d"]
    });

    const elements = {};
    let active = false;
    let animationFrame = null;
    let resizeTimer = null;

    function cacheElements() {
        [
            "ols-tab", "ols-panel", "ols-graph", "conditional-tab", "conditional-panel",
            "likelihood-tab", "likelihood-panel", "beta0-slider", "beta1-slider",
            "sigma-slider", "observation-slider", "sample-seed", "use-mle-button",
            "reset-button", "new-sample-button", "download-chart-button",
            "ols-sse-value", "ols-gap-value", "ols-equivalence-value"
        ].forEach((id) => {
            elements[id] = document.getElementById(id);
        });
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function linspace(start, end, count) {
        if (count <= 1) return [start];
        const values = new Array(count);
        const step = (end - start) / (count - 1);
        for (let index = 0; index < count; index += 1) values[index] = start + index * step;
        return values;
    }

    function mulberry32(seed) {
        let value = seed >>> 0;
        return function () {
            value += 0x6D2B79F5;
            let result = value;
            result = Math.imul(result ^ (result >>> 15), result | 1);
            result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
            return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
        };
    }

    function standardNormal(random) {
        const first = Math.max(Number.EPSILON, random());
        const second = random();
        return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
    }

    function generateSample(seed, count) {
        const random = mulberry32(seed);
        const points = new Array(count);
        for (let index = 0; index < count; index += 1) {
            const xIndex = Math.floor(random() * X_GRID.length);
            const x = X_GRID[Math.min(X_GRID.length - 1, xIndex)];
            const error = TRUE_MODEL.sigma * standardNormal(random);
            points[index] = {
                x,
                y: TRUE_MODEL.beta0 + TRUE_MODEL.beta1 * x + error,
                generationOrder: index
            };
        }
        points.sort((first, second) => first.x - second.x || first.generationOrder - second.generationOrder);
        return {
            x: points.map((point) => point.x),
            y: points.map((point) => point.y)
        };
    }

    function estimateOls(x, y) {
        const n = x.length;
        const xMean = x.reduce((sum, value) => sum + value, 0) / n;
        const yMean = y.reduce((sum, value) => sum + value, 0) / n;
        let numerator = 0;
        let denominator = 0;
        for (let index = 0; index < n; index += 1) {
            numerator += (x[index] - xMean) * (y[index] - yMean);
            denominator += (x[index] - xMean) ** 2;
        }
        const beta1 = denominator > 1e-12 ? numerator / denominator : 0;
        const beta0 = yMean - beta1 * xMean;
        let sse = 0;
        for (let index = 0; index < n; index += 1) {
            const residual = y[index] - beta0 - beta1 * x[index];
            sse += residual * residual;
        }
        return { beta0, beta1, sse };
    }

    function currentValues() {
        return {
            beta0: Number(elements["beta0-slider"].value),
            beta1: Number(elements["beta1-slider"].value),
            sigma: Number(elements["sigma-slider"].value),
            observations: Number(elements["observation-slider"].value),
            seed: Number(elements["sample-seed"].textContent)
        };
    }

    function modelFor(sample, beta0, beta1) {
        const fitted = new Array(sample.x.length);
        const residuals = new Array(sample.x.length);
        let sse = 0;
        for (let index = 0; index < sample.x.length; index += 1) {
            const fit = beta0 + beta1 * sample.x[index];
            const residual = sample.y[index] - fit;
            fitted[index] = fit;
            residuals[index] = residual;
            sse += residual * residual;
        }
        return { fitted, residuals, sse };
    }

    function selectedSquareIndices(length) {
        const maximum = 40;
        if (length <= maximum) return Array.from({ length }, (_, index) => index);
        const indices = [];
        for (let index = 0; index < maximum; index += 1) {
            indices.push(Math.round(index * (length - 1) / (maximum - 1)));
        }
        return [...new Set(indices)];
    }

    function plotHeight() {
        if (window.innerWidth <= 520) return 430;
        if (window.innerWidth <= 820) return 480;
        return 660;
    }

    function format(value) {
        return Number(value).toLocaleString("en-US", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        });
    }

    function buildFigure() {
        const values = currentValues();
        const sample = generateSample(values.seed, values.observations);
        const current = modelFor(sample, values.beta0, values.beta1);
        const optimum = estimateOls(sample.x, sample.y);
        const xLine = linspace(0, 10, 240);
        const currentLine = xLine.map((x) => values.beta0 + values.beta1 * x);
        const optimumLine = xLine.map((x) => optimum.beta0 + optimum.beta1 * x);

        let yMin = Math.min(...sample.y, ...currentLine, ...optimumLine);
        let yMax = Math.max(...sample.y, ...currentLine, ...optimumLine);
        const padding = Math.max(0.8, 0.09 * (yMax - yMin));
        yMin -= padding;
        yMax += padding;

        const residualX = [];
        const residualY = [];
        sample.x.forEach((x, index) => {
            residualX.push(x, x, null);
            residualY.push(current.fitted[index], sample.y[index], null);
        });

        const squareIndices = selectedSquareIndices(sample.x.length);
        const shapes = squareIndices.map((index) => {
            const x = sample.x[index];
            const fitted = current.fitted[index];
            const observed = sample.y[index];
            const side = Math.abs(current.residuals[index]);
            const direction = x + side <= 10.15 ? 1 : -1;
            return {
                type: "rect",
                xref: "x",
                yref: "y",
                x0: x,
                x1: x + direction * side,
                y0: Math.min(fitted, observed),
                y1: Math.max(fitted, observed),
                line: { color: "rgba(220,38,38,0.42)", width: 1 },
                fillcolor: "rgba(220,38,38,0.09)",
                layer: "below"
            };
        });

        const pointSize = clamp(10.3 - 0.022 * (sample.x.length - 14), 5.5, 10.3);
        const traces = [
            {
                type: "scatter",
                x: residualX,
                y: residualY,
                mode: "lines",
                line: { color: "rgba(71,85,105,0.56)", width: 1.35, dash: "dot" },
                hoverinfo: "skip",
                name: "Residuals"
            },
            {
                type: "scatter",
                x: xLine,
                y: optimumLine,
                mode: "lines",
                line: { color: COLORS.amber, width: 2.4, dash: "dash" },
                name: "OLS / MLE optimum",
                hovertemplate: `<b>OLS optimum</b><br>β₀ = ${optimum.beta0.toFixed(4)}<br>β₁ = ${optimum.beta1.toFixed(4)}<extra></extra>`
            },
            {
                type: "scatter",
                x: xLine,
                y: currentLine,
                mode: "lines",
                line: { color: COLORS.blue, width: 3.2 },
                name: "Current candidate line",
                hovertemplate: "<b>Current line</b><br>x = %{x:.3f}<br>ŷ = %{y:.3f}<extra></extra>"
            },
            {
                type: "scatter",
                x: sample.x,
                y: sample.y,
                mode: "markers",
                marker: {
                    size: pointSize,
                    color: COLORS.teal,
                    opacity: 0.92,
                    line: { color: COLORS.white, width: sample.x.length > 100 ? 0.7 : 1.2 }
                },
                customdata: current.fitted.map((fit, index) => [fit, current.residuals[index], current.residuals[index] ** 2]),
                name: "Observed data",
                hovertemplate: "<b>Observation</b><br>x = %{x:.3f}<br>y = %{y:.3f}<br>ŷ = %{customdata[0]:.3f}<br>e = %{customdata[1]:.3f}<br>e² = %{customdata[2]:.3f}<extra></extra>"
            }
        ];

        const equivalenceConstant = -0.5 * sample.x.length * Math.log(2 * Math.PI * values.sigma * values.sigma);
        const currentLogLikelihood = equivalenceConstant - current.sse / (2 * values.sigma * values.sigma);

        const layout = {
            height: plotHeight(),
            margin: { l: 70, r: 30, t: 52, b: 78 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: COLORS.white,
            font: { family: "Inter, Arial, sans-serif", color: COLORS.navy },
            hovermode: "closest",
            shapes,
            xaxis: {
                title: { text: "Predictor, x", standoff: 14 },
                range: [0, 10.2],
                showgrid: true,
                gridcolor: COLORS.grid,
                zeroline: false,
                linecolor: COLORS.border,
                mirror: true,
                scaleanchor: "y",
                scaleratio: 1
            },
            yaxis: {
                title: { text: "Outcome, y", standoff: 12 },
                range: [yMin, yMax],
                showgrid: true,
                gridcolor: COLORS.grid,
                zeroline: false,
                linecolor: COLORS.border,
                mirror: true,
                constrain: "domain"
            },
            legend: {
                orientation: "h",
                yanchor: "top",
                y: -0.14,
                xanchor: "left",
                x: 0,
                font: { size: 12, color: COLORS.slate }
            },
            annotations: [
                {
                    x: 0.02,
                    y: 0.98,
                    xref: "paper",
                    yref: "paper",
                    text: `SSE = Σeᵢ² = ${format(current.sse)}<br>Minimum SSE = ${format(optimum.sse)} · n = ${sample.x.length}`,
                    showarrow: false,
                    align: "left",
                    xanchor: "left",
                    yanchor: "top",
                    bordercolor: "rgba(37,99,235,0.24)",
                    borderwidth: 1,
                    borderpad: 10,
                    bgcolor: "rgba(255,255,255,0.92)",
                    font: { color: COLORS.navy, size: 13 }
                }
            ],
            hoverlabel: {
                bgcolor: COLORS.white,
                bordercolor: COLORS.border,
                font: { color: COLORS.navy, size: 12 }
            },
            uirevision: `ols-${values.seed}-${values.observations}`,
            transition: { duration: 0 }
        };

        return {
            data: traces,
            layout,
            current,
            optimum,
            currentLogLikelihood,
            squareCount: squareIndices.length,
            observations: sample.x.length
        };
    }

    function updateCards(figure) {
        elements["ols-sse-value"].textContent = format(figure.current.sse);
        elements["ols-gap-value"].textContent = format(Math.max(0, figure.current.sse - figure.optimum.sse));
        elements["ols-equivalence-value"].textContent = `ℓ = constant − SSE / (2σ²)`;
        const note = document.getElementById("ols-square-note");
        if (note) {
            note.textContent = figure.squareCount === figure.observations
                ? "Each shaded square has side |eᵢ|, so its area represents eᵢ²."
                : `Residual lines use all ${figure.observations} observations; ${figure.squareCount} representative squared-residual areas are drawn for readability.`;
        }
    }

    function render() {
        if (!active || !elements["ols-graph"]) return Promise.resolve();
        const figure = buildFigure();
        return Plotly.react(elements["ols-graph"], figure.data, figure.layout, PLOT_CONFIG)
            .then(() => updateCards(figure));
    }

    function scheduleRender() {
        if (!active) return;
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(() => {
            animationFrame = null;
            render().catch((error) => console.error("The least-squares view could not be rendered.", error));
        });
    }

    function setActive(isActive) {
        active = isActive;
        document.body.classList.toggle("ols-view-active", isActive);
        elements["ols-tab"].classList.toggle("is-active", isActive);
        elements["ols-tab"].setAttribute("aria-selected", String(isActive));
        elements["ols-panel"].classList.toggle("is-hidden", !isActive);
        if (isActive) {
            elements["conditional-tab"].classList.remove("is-active");
            elements["likelihood-tab"].classList.remove("is-active");
            elements["conditional-tab"].setAttribute("aria-selected", "false");
            elements["likelihood-tab"].setAttribute("aria-selected", "false");
            elements["conditional-panel"].classList.add("is-hidden");
            elements["likelihood-panel"].classList.add("is-hidden");
            render().then(() => requestAnimationFrame(() => Plotly.Plots.resize(elements["ols-graph"])))
                .catch((error) => console.error("The least-squares view could not be rendered.", error));
        }
    }

    function attachListeners() {
        elements["ols-tab"].addEventListener("click", () => setActive(true));
        ["conditional-tab", "likelihood-tab"].forEach((id) => {
            elements[id].addEventListener("click", () => setActive(false));
        });

        ["beta0-slider", "beta1-slider", "sigma-slider", "observation-slider"].forEach((id) => {
            elements[id].addEventListener("input", scheduleRender);
        });

        ["use-mle-button", "reset-button", "new-sample-button"].forEach((id) => {
            elements[id].addEventListener("click", () => requestAnimationFrame(scheduleRender));
        });

        elements["download-chart-button"].addEventListener("click", (event) => {
            if (!active) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            Plotly.downloadImage(elements["ols-graph"], {
                format: "png",
                filename: "regression-least-squares",
                scale: 2,
                width: 1500,
                height: 900
            });
        }, true);

        window.addEventListener("resize", () => {
            if (!active) return;
            if (resizeTimer !== null) clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                resizeTimer = null;
                Plotly.Plots.resize(elements["ols-graph"]);
                scheduleRender();
            }, 120);
        });
    }

    function initialize() {
        cacheElements();
        const missing = Object.entries(elements).filter(([, element]) => !element).map(([id]) => id);
        if (missing.length > 0) {
            console.error(`Least-squares view is missing required elements: ${missing.join(", ")}`);
            return;
        }
        attachListeners();
        const initialFigure = buildFigure();
        Plotly.newPlot(elements["ols-graph"], initialFigure.data, initialFigure.layout, PLOT_CONFIG)
            .then(() => updateCards(initialFigure))
            .catch((error) => console.error("The least-squares view could not be initialized.", error));
    }

    window.addEventListener("DOMContentLoaded", initialize);
}());
