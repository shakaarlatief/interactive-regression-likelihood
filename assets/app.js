(function () {
    "use strict";

    const DEFAULTS = Object.freeze({
        beta0: 1.2,
        beta1: 0.75,
        sigma: 1.1,
        observations: 14,
        slices: 7,
        seed: 17
    });

    const TRUE_MODEL = Object.freeze({ beta0: 1.2, beta1: 0.75, sigma: 1.1 });

    const LIMITS = Object.freeze({
        beta0: { min: -4, max: 6 },
        beta1: { min: -2, max: 3 },
        sigma: { min: 0.35, max: 3 },
        observations: { min: 14, max: 200 },
        slices: { min: 4 }
    });

    const COLORS = Object.freeze({
        navy: "#0F172A",
        slate: "#475569",
        muted: "#64748B",
        border: "#D8E1EC",
        grid: "rgba(148, 163, 184, 0.22)",
        blueDark: "#1D4ED8",
        indigo: "#6366F1",
        teal: "#0891B2",
        amber: "#D97706",
        red: "#DC2626",
        white: "#FFFFFF"
    });

    const X_GRID = Object.freeze(Array.from({ length: 91 }, (_, index) => 0.5 + index * 0.1));
    const PROFILE_SCALE = 0.62;
    const DENSITY_POINTS = 92;
    const LINE_POINTS = 240;
    const LIKELIHOOD_GRID_POINTS = 61;

    const PLOT_CONFIG = Object.freeze({
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
        toImageButtonOptions: {
            format: "png",
            filename: "regression-likelihood-explorer",
            scale: 2
        }
    });

    const state = {
        beta0: DEFAULTS.beta0,
        beta1: DEFAULTS.beta1,
        sigma: DEFAULTS.sigma,
        observations: DEFAULTS.observations,
        slices: DEFAULTS.slices,
        seed: DEFAULTS.seed,
        showResiduals: true,
        showContributions: true,
        activeTab: "conditional",
        sample: null,
        animationFrame: null,
        likelihoodTimer: null,
        resizeTimer: null
    };

    const elements = {};

    function cacheElements() {
        const ids = [
            "beta0-slider", "beta1-slider", "sigma-slider", "observation-slider", "slice-slider",
            "beta0-display", "beta1-display", "sigma-display", "observation-display", "slice-display",
            "slice-mid-label", "slice-max-label",
            "show-residuals", "show-contributions", "use-mle-button", "reset-button",
            "new-sample-button", "candidate-equation", "sample-seed", "sample-size",
            "metric-loglik-value", "metric-gap-value", "metric-sse-value", "metric-rmse-value",
            "conditional-tab", "likelihood-tab", "conditional-panel", "likelihood-panel",
            "conditional-graph", "likelihood-graph", "download-chart-button"
        ];

        ids.forEach((id) => {
            elements[id] = document.getElementById(id);
        });

        const missing = ids.filter((id) => !elements[id]);
        if (missing.length > 0) {
            throw new Error(`Missing required HTML elements: ${missing.join(", ")}`);
        }
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function linspace(start, end, count) {
        if (count <= 1) return [start];
        const values = new Array(count);
        const step = (end - start) / (count - 1);
        for (let index = 0; index < count; index += 1) {
            values[index] = start + index * step;
        }
        return values;
    }

    function normalPdf(value, mean, sigma) {
        const z = (value - mean) / sigma;
        return Math.exp(-0.5 * z * z) / (Math.sqrt(2 * Math.PI) * sigma);
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
        const safeCount = Math.round(clamp(count, LIMITS.observations.min, LIMITS.observations.max));
        const random = mulberry32(seed);
        const points = new Array(safeCount);

        for (let index = 0; index < safeCount; index += 1) {
            const xIndex = Math.floor(random() * X_GRID.length);
            const x = X_GRID[Math.min(X_GRID.length - 1, xIndex)];
            const error = TRUE_MODEL.sigma * standardNormal(random);
            const y = TRUE_MODEL.beta0 + TRUE_MODEL.beta1 * x + error;
            points[index] = { x, y, generationOrder: index };
        }

        points.sort((first, second) => (
            first.x - second.x || first.generationOrder - second.generationOrder
        ));

        return prepareSample(
            seed,
            points.map((point) => point.x),
            points.map((point) => point.y)
        );
    }

    function estimateMle(x, y) {
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
        const fitted = x.map((value) => beta0 + beta1 * value);
        const residuals = y.map((value, index) => value - fitted[index]);
        const sse = residuals.reduce((sum, value) => sum + value * value, 0);
        const sigma = Math.sqrt(Math.max(sse / n, 1e-12));
        const logLikelihood = -0.5 * n * Math.log(2 * Math.PI * sigma * sigma) - sse / (2 * sigma * sigma);

        return { beta0, beta1, sigma, fitted, residuals, sse, logLikelihood };
    }

    function prepareLikelihoodGrid(x, y, mle) {
        const beta0 = linspace(mle.beta0 - 3.2, mle.beta0 + 3.2, LIKELIHOOD_GRID_POINTS);
        const beta1 = linspace(mle.beta1 - 1.35, mle.beta1 + 1.35, LIKELIHOOD_GRID_POINTS);
        const sse = beta1.map((slope) => beta0.map((intercept) => {
            let total = 0;
            for (let index = 0; index < x.length; index += 1) {
                const residual = y[index] - intercept - slope * x[index];
                total += residual * residual;
            }
            return total;
        }));
        return { beta0, beta1, sse };
    }

    function prepareSample(seed, x, y) {
        const mle = estimateMle(x, y);
        return {
            seed,
            x,
            y,
            mle,
            likelihoodGrid: prepareLikelihoodGrid(x, y, mle)
        };
    }

    function computeModel(sample, beta0, beta1, sigma) {
        const fitted = new Array(sample.x.length);
        const residuals = new Array(sample.x.length);
        let sse = 0;

        for (let index = 0; index < sample.x.length; index += 1) {
            const mean = beta0 + beta1 * sample.x[index];
            const residual = sample.y[index] - mean;
            fitted[index] = mean;
            residuals[index] = residual;
            sse += residual * residual;
        }

        const n = sample.y.length;
        const sigmaSquared = sigma * sigma;
        const logLikelihood = -0.5 * n * Math.log(2 * Math.PI * sigmaSquared) - sse / (2 * sigmaSquared);

        return {
            fitted,
            residuals,
            sse,
            rmse: Math.sqrt(sse / n),
            logLikelihood,
            likelihoodGap: Math.max(0, sample.mle.logLikelihood - logLikelihood)
        };
    }

    function evenlySpacedIndices(length, count) {
        const safeCount = Math.min(length, Math.max(1, Math.round(count)));
        if (safeCount === length) return Array.from({ length }, (_, index) => index);
        if (safeCount === 1) return [Math.floor((length - 1) / 2)];

        const result = [];
        for (let index = 0; index < safeCount; index += 1) {
            const candidate = Math.round(index * (length - 1) / (safeCount - 1));
            if (result.length === 0 || result[result.length - 1] !== candidate) {
                result.push(candidate);
            }
        }
        return result;
    }

    function formatNumber(value, digits = 3) {
        return Number(value).toLocaleString("en-US", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    }

    function mainPlotHeight() {
        if (window.innerWidth <= 520) return 520;
        if (window.innerWidth <= 820) return 570;
        return 660;
    }

    function buildMainFigure() {
        const sample = state.sample;
        const model = computeModel(sample, state.beta0, state.beta1, state.sigma);
        const xLine = linspace(0, 10, LINE_POINTS);
        const meanLine = xLine.map((value) => state.beta0 + state.beta1 * value);

        let yMin = Math.min(...sample.y, ...meanLine);
        let yMax = Math.max(...sample.y, ...meanLine);
        model.fitted.forEach((mean) => {
            yMin = Math.min(yMin, mean - 3.6 * state.sigma);
            yMax = Math.max(yMax, mean + 3.6 * state.sigma);
        });
        const padding = Math.max(0.75, 0.08 * (yMax - yMin));
        yMin -= padding;
        yMax += padding;

        const traces = [];

        if (state.showResiduals) {
            const residualX = [];
            const residualY = [];
            sample.x.forEach((xValue, index) => {
                residualX.push(xValue, xValue, null);
                residualY.push(model.fitted[index], sample.y[index], null);
            });
            traces.push({
                type: "scatter",
                x: residualX,
                y: residualY,
                mode: "lines",
                line: { color: "rgba(71,85,105,0.42)", width: 1.15, dash: "dot" },
                hoverinfo: "skip",
                name: "Residuals",
                legendgroup: "residuals"
            });
        }

        const indices = evenlySpacedIndices(sample.x.length, state.slices);
        const densityX = [];
        const densityY = [];
        const guideX = [];
        const guideY = [];
        const centerX = [];
        const centerY = [];
        const centerCustom = [];
        const contributionX = [];
        const contributionY = [];
        const contributionSize = [];
        const contributionCustom = [];

        indices.forEach((dataIndex) => {
            const xValue = sample.x[dataIndex];
            const yValue = sample.y[dataIndex];
            const mean = model.fitted[dataIndex];
            const yGrid = linspace(mean - 3.55 * state.sigma, mean + 3.55 * state.sigma, DENSITY_POINTS);
            const widths = yGrid.map((value) => PROFILE_SCALE * normalPdf(value, mean, state.sigma));

            for (let index = 0; index < yGrid.length; index += 1) {
                densityX.push(xValue);
                densityY.push(yGrid[index]);
            }
            for (let index = yGrid.length - 1; index >= 0; index -= 1) {
                densityX.push(xValue + widths[index]);
                densityY.push(yGrid[index]);
            }
            densityX.push(null);
            densityY.push(null);

            guideX.push(xValue, xValue, null);
            guideY.push(yGrid[0], yGrid[yGrid.length - 1], null);
            centerX.push(xValue);
            centerY.push(mean);
            centerCustom.push([mean, state.sigma]);

            if (state.showContributions) {
                const density = normalPdf(yValue, mean, state.sigma);
                const endpoint = xValue + PROFILE_SCALE * density;
                const logDensity = Math.log(Math.max(density, Number.MIN_VALUE));
                const custom = [density, logDensity, xValue, yValue, mean];
                contributionX.push(xValue, endpoint, null);
                contributionY.push(yValue, yValue, null);
                contributionSize.push(0.1, 6.5, 0.1);
                contributionCustom.push(custom, custom, custom);
            }
        });

        traces.push({
            type: "scatter",
            x: densityX,
            y: densityY,
            mode: "lines",
            line: { color: "rgba(99,102,241,0.67)", width: state.slices > 80 ? 0.7 : 1.15 },
            fill: "toself",
            fillcolor: state.slices > 80 ? "rgba(99,102,241,0.045)" : "rgba(99,102,241,0.105)",
            hoverinfo: "skip",
            name: "Conditional density",
            legendgroup: "density"
        });

        traces.push({
            type: "scatter",
            x: guideX,
            y: guideY,
            mode: "lines",
            line: { color: "rgba(99,102,241,0.24)", width: 0.8, dash: "dot" },
            hoverinfo: "skip",
            showlegend: false,
            legendgroup: "density"
        });

        traces.push({
            type: "scatter",
            x: centerX,
            y: centerY,
            mode: "markers",
            marker: {
                size: state.slices > 80 ? 4 : 7,
                color: COLORS.white,
                line: { color: COLORS.blueDark, width: state.slices > 80 ? 1 : 1.7 }
            },
            customdata: centerCustom,
            hovertemplate: "<b>Conditional center</b><br>x = %{x:.2f}<br>E[Y | X=x] = %{customdata[0]:.3f}<br>σ = %{customdata[1]:.3f}<extra></extra>",
            showlegend: false
        });

        if (state.showContributions) {
            traces.push({
                type: "scatter",
                x: contributionX,
                y: contributionY,
                mode: "lines+markers",
                connectgaps: false,
                line: { color: "rgba(217,119,6,0.66)", width: state.slices > 80 ? 0.8 : 1.7 },
                marker: {
                    size: contributionSize,
                    color: COLORS.amber,
                    line: { color: COLORS.white, width: 0.8 }
                },
                customdata: contributionCustom,
                hovertemplate: "<b>Likelihood contribution</b><br>x = %{customdata[2]:.2f}<br>Observed y = %{customdata[3]:.3f}<br>Model mean = %{customdata[4]:.3f}<br>Density = %{customdata[0]:.5f}<br>Log density = %{customdata[1]:.5f}<extra></extra>",
                showlegend: true,
                name: "Density at observed y",
                legendgroup: "contribution"
            });
        }

        traces.push({
            type: "scatter",
            x: xLine,
            y: meanLine,
            mode: "lines",
            line: { color: COLORS.blueDark, width: 3.2 },
            name: "Conditional mean",
            hovertemplate: "<b>Conditional mean</b><br>x = %{x:.3f}<br>E[Y | X=x] = %{y:.3f}<extra></extra>"
        });

        const pointSize = clamp(10.3 - 0.022 * (sample.x.length - DEFAULTS.observations), 5.5, 10.3);
        traces.push({
            type: "scatter",
            x: sample.x,
            y: sample.y,
            mode: "markers",
            marker: {
                size: pointSize,
                color: COLORS.teal,
                opacity: 0.9,
                line: { color: COLORS.white, width: sample.x.length > 100 ? 0.7 : 1.2 }
            },
            customdata: model.fitted.map((mean, index) => [mean, model.residuals[index]]),
            name: "Observed data",
            hovertemplate: "<b>Observed point</b><br>x = %{x:.3f}<br>y = %{y:.3f}<br>Model mean = %{customdata[0]:.3f}<br>Residual = %{customdata[1]:.3f}<extra></extra>"
        });

        const middleIndex = indices[Math.floor(indices.length / 2)];
        const annotationX = sample.x[middleIndex];
        const annotationY = model.fitted[middleIndex];

        const layout = {
            height: mainPlotHeight(),
            margin: { l: 70, r: 30, t: 52, b: 78 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: COLORS.white,
            font: { family: "Inter, Arial, sans-serif", color: COLORS.navy },
            hovermode: "closest",
            xaxis: {
                title: { text: "Predictor, x", standoff: 14 },
                range: [0, 10.2],
                showgrid: true,
                gridcolor: COLORS.grid,
                zeroline: false,
                linecolor: COLORS.border,
                linewidth: 1,
                mirror: true,
                ticks: "outside",
                tickcolor: COLORS.border
            },
            yaxis: {
                title: { text: "Outcome, y", standoff: 12 },
                range: [yMin, yMax],
                showgrid: true,
                gridcolor: COLORS.grid,
                zeroline: false,
                linecolor: COLORS.border,
                linewidth: 1,
                mirror: true,
                ticks: "outside",
                tickcolor: COLORS.border
            },
            legend: {
                orientation: "h",
                yanchor: "top",
                y: -0.14,
                xanchor: "left",
                x: 0,
                font: { size: 12, color: COLORS.slate },
                itemclick: "toggle",
                itemdoubleclick: "toggleothers"
            },
            annotations: [
                {
                    x: 0.02,
                    y: 0.98,
                    xref: "paper",
                    yref: "paper",
                    text: `E[Y | X=x] = ${state.beta0.toFixed(2)} + ${state.beta1.toFixed(3)}x<br>σ = ${state.sigma.toFixed(3)} · n = ${sample.y.length}`,
                    showarrow: false,
                    align: "left",
                    xanchor: "left",
                    yanchor: "top",
                    bordercolor: "rgba(37,99,235,0.24)",
                    borderwidth: 1,
                    borderpad: 10,
                    bgcolor: "rgba(255,255,255,0.92)",
                    font: { color: COLORS.navy, size: 13 }
                },
                {
                    x: annotationX,
                    y: annotationY,
                    text: "Every conditional density is centered<br>on the same regression line",
                    showarrow: true,
                    arrowhead: 2,
                    arrowsize: 1,
                    arrowwidth: 1.4,
                    arrowcolor: COLORS.indigo,
                    ax: 92,
                    ay: -92,
                    bgcolor: "rgba(255,255,255,0.94)",
                    bordercolor: "rgba(99,102,241,0.26)",
                    borderwidth: 1,
                    borderpad: 7,
                    font: { color: COLORS.slate, size: 12 },
                    align: "left"
                }
            ],
            hoverlabel: {
                bgcolor: COLORS.white,
                bordercolor: COLORS.border,
                font: { color: COLORS.navy, size: 12 }
            },
            uirevision: `conditional-${sample.seed}-${sample.y.length}-${state.slices}`,
            transition: { duration: 0 }
        };

        return { data: traces, layout, model };
    }

    function buildLikelihoodFigure() {
        const sample = state.sample;
        const grid = sample.likelihoodGrid;
        const n = sample.y.length;
        const sigmaSquared = state.sigma * state.sigma;
        const constant = -0.5 * n * Math.log(2 * Math.PI * sigmaSquared);
        const z = grid.sse.map((row) => row.map((sse) => constant - sse / (2 * sigmaSquared)));

        return {
            data: [
                {
                    type: "contour",
                    x: grid.beta0,
                    y: grid.beta1,
                    z,
                    colorscale: [
                        [0.0, "#EFF6FF"],
                        [0.18, "#DBEAFE"],
                        [0.42, "#BFDBFE"],
                        [0.66, "#818CF8"],
                        [0.84, "#4F46E5"],
                        [1.0, "#312E81"]
                    ],
                    contours: { coloring: "heatmap", showlabels: false },
                    line: { color: "rgba(255,255,255,0.44)", width: 0.6 },
                    colorbar: {
                        title: { text: "Log-likelihood", side: "right" },
                        thickness: 14,
                        len: 0.8,
                        outlinewidth: 0
                    },
                    hovertemplate: "β₀ = %{x:.3f}<br>β₁ = %{y:.3f}<br>Log-likelihood = %{z:.3f}<extra></extra>",
                    name: "Log-likelihood"
                },
                {
                    type: "scatter",
                    x: [sample.mle.beta0],
                    y: [sample.mle.beta1],
                    mode: "markers+text",
                    marker: {
                        size: 14,
                        symbol: "star",
                        color: COLORS.amber,
                        line: { color: COLORS.white, width: 1.5 }
                    },
                    text: ["MLE"],
                    textposition: "top center",
                    textfont: { color: COLORS.navy, size: 12 },
                    name: "MLE",
                    hovertemplate: `<b>Maximum-likelihood estimate</b><br>β₀ = ${sample.mle.beta0.toFixed(4)}<br>β₁ = ${sample.mle.beta1.toFixed(4)}<extra></extra>`
                },
                {
                    type: "scatter",
                    x: [state.beta0],
                    y: [state.beta1],
                    mode: "markers+text",
                    marker: { size: 12, color: COLORS.red, line: { color: COLORS.white, width: 1.5 } },
                    text: ["Current"],
                    textposition: "bottom center",
                    textfont: { color: COLORS.navy, size: 12 },
                    name: "Current parameters",
                    hovertemplate: `<b>Current candidate</b><br>β₀ = ${state.beta0.toFixed(4)}<br>β₁ = ${state.beta1.toFixed(4)}<extra></extra>`
                }
            ],
            layout: {
                height: mainPlotHeight(),
                margin: { l: 70, r: 46, t: 45, b: 76 },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: COLORS.white,
                font: { family: "Inter, Arial, sans-serif", color: COLORS.navy },
                xaxis: {
                    title: { text: "Intercept, β₀", standoff: 14 },
                    showgrid: true,
                    gridcolor: COLORS.grid,
                    zeroline: false,
                    linecolor: COLORS.border,
                    mirror: true
                },
                yaxis: {
                    title: { text: "Slope, β₁", standoff: 14 },
                    showgrid: true,
                    gridcolor: COLORS.grid,
                    zeroline: false,
                    linecolor: COLORS.border,
                    mirror: true
                },
                legend: {
                    orientation: "h",
                    yanchor: "top",
                    y: -0.13,
                    xanchor: "left",
                    x: 0,
                    font: { size: 12, color: COLORS.slate }
                },
                hoverlabel: {
                    bgcolor: COLORS.white,
                    bordercolor: COLORS.border,
                    font: { color: COLORS.navy, size: 12 }
                },
                uirevision: `likelihood-${sample.seed}-${sample.y.length}`,
                transition: { duration: 0 }
            }
        };
    }

    function updateSliceControl() {
        const maximum = state.observations;
        elements["slice-slider"].max = String(maximum);
        state.slices = Math.round(clamp(state.slices, LIMITS.slices.min, maximum));
        elements["slice-slider"].value = String(state.slices);
        elements["slice-mid-label"].textContent = String(Math.round((LIMITS.slices.min + maximum) / 2));
        elements["slice-max-label"].textContent = String(maximum);
    }

    function updateInterface(model) {
        elements["beta0-display"].textContent = state.beta0.toFixed(3);
        elements["beta1-display"].textContent = state.beta1.toFixed(3);
        elements["sigma-display"].textContent = state.sigma.toFixed(3);
        elements["observation-display"].textContent = String(state.observations);
        elements["slice-display"].textContent = String(state.slices);
        elements["candidate-equation"].textContent = `Current: N(${state.beta0.toFixed(2)} + ${state.beta1.toFixed(3)}x, ${state.sigma.toFixed(3)}²)`;
        elements["sample-seed"].textContent = String(state.seed);
        elements["sample-size"].textContent = String(state.observations);
        elements["metric-loglik-value"].textContent = formatNumber(model.logLikelihood);
        elements["metric-gap-value"].textContent = formatNumber(model.likelihoodGap);
        elements["metric-sse-value"].textContent = formatNumber(model.sse);
        elements["metric-rmse-value"].textContent = formatNumber(model.rmse);
    }

    function renderMain() {
        const figure = buildMainFigure();
        return Plotly.react(elements["conditional-graph"], figure.data, figure.layout, PLOT_CONFIG)
            .then(() => updateInterface(figure.model));
    }

    function renderLikelihood() {
        const figure = buildLikelihoodFigure();
        return Plotly.react(elements["likelihood-graph"], figure.data, figure.layout, PLOT_CONFIG);
    }

    function scheduleRender(options = {}) {
        const forceLikelihood = Boolean(options.forceLikelihood);

        if (state.animationFrame !== null) {
            cancelAnimationFrame(state.animationFrame);
        }

        state.animationFrame = requestAnimationFrame(() => {
            state.animationFrame = null;
            if (state.activeTab === "conditional") {
                renderMain().catch(reportRenderError);
            } else {
                updateInterface(computeModel(state.sample, state.beta0, state.beta1, state.sigma));
            }
        });

        if (state.likelihoodTimer !== null) {
            clearTimeout(state.likelihoodTimer);
        }

        if (state.activeTab === "likelihood" || forceLikelihood) {
            state.likelihoodTimer = window.setTimeout(() => {
                state.likelihoodTimer = null;
                renderLikelihood().catch(reportRenderError);
            }, forceLikelihood ? 0 : 60);
        }
    }

    function regenerateSample() {
        state.sample = generateSample(state.seed, state.observations);
        updateSliceControl();
    }

    function syncStateFromControls(changedId) {
        state.beta0 = Number(elements["beta0-slider"].value);
        state.beta1 = Number(elements["beta1-slider"].value);
        state.sigma = Math.max(0.000001, Number(elements["sigma-slider"].value));
        state.showResiduals = elements["show-residuals"].checked;
        state.showContributions = elements["show-contributions"].checked;

        if (changedId === "observation-slider") {
            state.observations = Math.round(clamp(
                Number(elements["observation-slider"].value),
                LIMITS.observations.min,
                LIMITS.observations.max
            ));
            regenerateSample();
        }

        if (changedId === "slice-slider") {
            state.slices = Math.round(clamp(
                Number(elements["slice-slider"].value),
                LIMITS.slices.min,
                state.observations
            ));
        }
    }

    function syncControlsFromState() {
        elements["beta0-slider"].value = String(state.beta0);
        elements["beta1-slider"].value = String(state.beta1);
        elements["sigma-slider"].value = String(state.sigma);
        elements["observation-slider"].value = String(state.observations);
        elements["show-residuals"].checked = state.showResiduals;
        elements["show-contributions"].checked = state.showContributions;
        updateSliceControl();
    }

    function setParameters(beta0, beta1, sigma) {
        state.beta0 = clamp(beta0, LIMITS.beta0.min, LIMITS.beta0.max);
        state.beta1 = clamp(beta1, LIMITS.beta1.min, LIMITS.beta1.max);
        state.sigma = clamp(sigma, LIMITS.sigma.min, LIMITS.sigma.max);
        syncControlsFromState();
        scheduleRender({ forceLikelihood: true });
    }

    function setActiveTab(tab) {
        state.activeTab = tab;
        const conditionalActive = tab === "conditional";

        elements["conditional-tab"].classList.toggle("is-active", conditionalActive);
        elements["likelihood-tab"].classList.toggle("is-active", !conditionalActive);
        elements["conditional-tab"].setAttribute("aria-selected", String(conditionalActive));
        elements["likelihood-tab"].setAttribute("aria-selected", String(!conditionalActive));
        elements["conditional-panel"].classList.toggle("is-hidden", !conditionalActive);
        elements["likelihood-panel"].classList.toggle("is-hidden", conditionalActive);

        if (conditionalActive) {
            renderMain().catch(reportRenderError);
            requestAnimationFrame(() => Plotly.Plots.resize(elements["conditional-graph"]));
        } else {
            renderLikelihood().catch(reportRenderError);
            requestAnimationFrame(() => Plotly.Plots.resize(elements["likelihood-graph"]));
        }
    }

    function downloadCurrentChart() {
        const graph = state.activeTab === "conditional"
            ? elements["conditional-graph"]
            : elements["likelihood-graph"];
        const suffix = state.activeTab === "conditional"
            ? "conditional-distributions"
            : "likelihood-landscape";
        Plotly.downloadImage(graph, {
            format: "png",
            filename: `regression-${suffix}`,
            scale: 2,
            width: 1500,
            height: 900
        });
    }

    function attachEventListeners() {
        ["beta0-slider", "beta1-slider", "sigma-slider", "observation-slider", "slice-slider"]
            .forEach((id) => {
                elements[id].addEventListener("input", () => {
                    syncStateFromControls(id);
                    scheduleRender({ forceLikelihood: id === "observation-slider" });
                });
            });

        ["show-residuals", "show-contributions"].forEach((id) => {
            elements[id].addEventListener("change", () => {
                syncStateFromControls(id);
                scheduleRender();
            });
        });

        elements["use-mle-button"].addEventListener("click", () => {
            const mle = state.sample.mle;
            setParameters(mle.beta0, mle.beta1, mle.sigma);
        });

        elements["reset-button"].addEventListener("click", () => {
            state.slices = Math.min(DEFAULTS.slices, state.observations);
            state.showResiduals = true;
            state.showContributions = true;
            setParameters(DEFAULTS.beta0, DEFAULTS.beta1, DEFAULTS.sigma);
        });

        elements["new-sample-button"].addEventListener("click", () => {
            state.seed += 1;
            state.slices = Math.min(DEFAULTS.slices, state.observations);
            state.showResiduals = true;
            state.showContributions = true;
            state.beta0 = DEFAULTS.beta0;
            state.beta1 = DEFAULTS.beta1;
            state.sigma = DEFAULTS.sigma;
            regenerateSample();
            syncControlsFromState();
            scheduleRender({ forceLikelihood: true });
        });

        elements["conditional-tab"].addEventListener("click", () => setActiveTab("conditional"));
        elements["likelihood-tab"].addEventListener("click", () => setActiveTab("likelihood"));
        elements["download-chart-button"].addEventListener("click", downloadCurrentChart);

        window.addEventListener("resize", () => {
            if (state.resizeTimer !== null) clearTimeout(state.resizeTimer);
            state.resizeTimer = window.setTimeout(() => {
                state.resizeTimer = null;
                const graph = state.activeTab === "conditional"
                    ? elements["conditional-graph"]
                    : elements["likelihood-graph"];
                Plotly.Plots.resize(graph);
                scheduleRender({ forceLikelihood: state.activeTab === "likelihood" });
            }, 120);
        });
    }

    function reportRenderError(error) {
        console.error("The visualization could not be rendered.", error);
    }

    function initializePlots() {
        const mainFigure = buildMainFigure();
        const likelihoodFigure = buildLikelihoodFigure();
        return Promise.all([
            Plotly.newPlot(elements["conditional-graph"], mainFigure.data, mainFigure.layout, PLOT_CONFIG),
            Plotly.newPlot(elements["likelihood-graph"], likelihoodFigure.data, likelihoodFigure.layout, PLOT_CONFIG)
        ]).then(() => updateInterface(mainFigure.model));
    }

    function initialize() {
        try {
            if (typeof Plotly === "undefined") {
                throw new Error("Plotly.js did not load.");
            }
            cacheElements();
            regenerateSample();
            syncControlsFromState();
            attachEventListeners();
            initializePlots().catch((error) => {
                reportRenderError(error);
                elements["conditional-graph"].innerHTML = '<div style="padding:32px;color:#991b1b">The visualization could not be initialized. Check the browser console for details.</div>';
            });
        } catch (error) {
            console.error("The application could not be initialized.", error);
            const graph = document.getElementById("conditional-graph");
            if (graph) {
                graph.innerHTML = '<div style="padding:32px;color:#991b1b">The visualization could not be initialized. Check the browser console for details.</div>';
            }
        }
    }

    window.addEventListener("DOMContentLoaded", initialize);
}());
