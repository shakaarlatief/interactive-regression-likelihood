(function () {
    "use strict";

    const MOBILE_BREAKPOINT = 820;
    const nativeNewPlot = window.Plotly && window.Plotly.newPlot
        ? window.Plotly.newPlot.bind(window.Plotly)
        : null;
    const nativeReact = window.Plotly && window.Plotly.react
        ? window.Plotly.react.bind(window.Plotly)
        : null;

    function isMobileViewport() {
        return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
    }

    function cloneAxis(axis, titleText) {
        if (!axis) return axis;
        return {
            ...axis,
            title: axis.title
                ? { ...axis.title, text: titleText, standoff: 8 }
                : axis.title,
            tickfont: { ...(axis.tickfont || {}), size: window.innerWidth <= 520 ? 10 : 11 },
            automargin: true
        };
    }

    function adaptAnnotations(annotations) {
        if (!Array.isArray(annotations) || annotations.length === 0) return annotations;
        const primary = {
            ...annotations[0],
            x: 0.01,
            y: 0.99,
            borderpad: 6,
            font: {
                ...(annotations[0].font || {}),
                size: window.innerWidth <= 520 ? 10 : 11
            }
        };
        return [primary];
    }

    function adaptData(data) {
        if (!isMobileViewport() || !Array.isArray(data)) return data;
        return data.map((trace) => {
            if (!trace || trace.type !== "contour") return trace;
            return {
                ...trace,
                colorbar: {
                    ...(trace.colorbar || {}),
                    thickness: window.innerWidth <= 520 ? 9 : 11,
                    len: 0.68,
                    tickfont: { size: window.innerWidth <= 520 ? 9 : 10 },
                    title: trace.colorbar && trace.colorbar.title
                        ? { ...trace.colorbar.title, text: "Log L", font: { size: 10 } }
                        : trace.colorbar && trace.colorbar.title
                }
            };
        });
    }

    function adaptLayout(layout) {
        if (!isMobileViewport() || !layout) return layout;

        const compact = window.innerWidth <= 520;
        const next = {
            ...layout,
            height: compact ? 430 : 480,
            margin: {
                ...(layout.margin || {}),
                l: compact ? 44 : 52,
                r: compact ? 10 : 18,
                t: compact ? 34 : 40,
                b: compact ? 86 : 82
            },
            font: {
                ...(layout.font || {}),
                size: compact ? 10 : 11
            },
            xaxis: cloneAxis(layout.xaxis, layout.xaxis && layout.xaxis.title && String(layout.xaxis.title.text).includes("Intercept") ? "β₀" : "x"),
            yaxis: cloneAxis(layout.yaxis, layout.yaxis && layout.yaxis.title && String(layout.yaxis.title.text).includes("Slope") ? "β₁" : "y"),
            legend: layout.legend
                ? {
                    ...layout.legend,
                    y: compact ? -0.21 : -0.18,
                    font: { ...(layout.legend.font || {}), size: compact ? 9 : 10 }
                }
                : layout.legend,
            annotations: adaptAnnotations(layout.annotations)
        };

        if (Array.isArray(next.data)) {
            delete next.data;
        }

        return next;
    }

    function adaptConfig(config) {
        if (!isMobileViewport()) return config;
        return {
            ...(config || {}),
            scrollZoom: false,
            displayModeBar: false,
            doubleClick: "reset"
        };
    }

    if (window.Plotly && nativeNewPlot && nativeReact) {
        window.Plotly.newPlot = function (graph, data, layout, config) {
            return nativeNewPlot(graph, adaptData(data), adaptLayout(layout), adaptConfig(config));
        };

        window.Plotly.react = function (graph, data, layout, config) {
            return nativeReact(graph, adaptData(data), adaptLayout(layout), adaptConfig(config));
        };
    }

    function resizeVisiblePlot() {
        if (!window.Plotly || !window.Plotly.Plots) return;
        const candidates = [
            ["conditional-panel", "conditional-graph"],
            ["ols-panel", "ols-graph"],
            ["likelihood-panel", "likelihood-graph"]
        ];
        const visible = candidates.find(([panelId]) => {
            const panel = document.getElementById(panelId);
            return panel && !panel.classList.contains("is-hidden");
        });
        const graph = visible ? document.getElementById(visible[1]) : null;
        if (graph) {
            window.requestAnimationFrame(() => window.Plotly.Plots.resize(graph));
        }
    }

    function initializeMobileControls() {
        const card = document.querySelector(".controls-card");
        const toggle = document.getElementById("mobile-controls-toggle");
        const label = document.getElementById("mobile-controls-toggle-label");
        if (!card || !toggle || !label) return;

        function setExpanded(expanded) {
            card.classList.toggle("is-mobile-expanded", expanded);
            toggle.setAttribute("aria-expanded", String(expanded));
            label.textContent = expanded ? "Fewer controls" : "More controls";
            resizeVisiblePlot();
        }

        toggle.addEventListener("click", () => {
            setExpanded(!card.classList.contains("is-mobile-expanded"));
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && card.classList.contains("is-mobile-expanded")) {
                setExpanded(false);
                toggle.focus();
            }
        });

        const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
        const handleBreakpointChange = (event) => {
            if (!event.matches) setExpanded(false);
            resizeVisiblePlot();
        };

        if (typeof media.addEventListener === "function") {
            media.addEventListener("change", handleBreakpointChange);
        } else if (typeof media.addListener === "function") {
            media.addListener(handleBreakpointChange);
        }
    }

    window.addEventListener("DOMContentLoaded", initializeMobileControls);
}());
