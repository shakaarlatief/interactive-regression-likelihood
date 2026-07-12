# Interactive Regression Likelihood Explorer

A static, portfolio-ready web application for exploring maximum likelihood in a normal homoskedastic linear regression.

The observed sample remains fixed while the user continuously changes:

- the intercept, β₀
- the slope, β₁
- the common conditional standard deviation, σ

The regression line, conditional normal densities, residuals, observation-level density contributions, log-likelihood, residual sum of squares, and likelihood landscape all respond immediately in the browser.

## Live application

The live application is available at:

```text
https://shakaarlatief.github.io/interactive-regression-likelihood/
```

## Portfolio presentation

After the first deployment, capture a screenshot of the live static application and add it near the top of this README. This ensures the repository preview always reflects the deployed version rather than an earlier implementation.

## Why this version is suitable for GitHub Pages

The application uses only static browser technologies:

- HTML for structure
- CSS for presentation
- vanilla JavaScript for the statistical calculations and interaction
- Plotly.js for the charts

There is no Python server, database, API key, or backend process. Slider movement is handled with the browser `input` event and rendering is coordinated with `requestAnimationFrame`, so the figure changes while the slider is being dragged.

The Plotly.js runtime is included locally under `assets/vendor/`. The application therefore does not depend on a third-party CDN at runtime.

## Project structure

```text
interactive-regression-likelihood/
├── index.html
├── README.md
├── LICENSE
├── .gitignore
├── .nojekyll
├── assets/
│   ├── app.js
│   ├── mobile.js
│   ├── favicon.svg
│   ├── style.css
│   ├── mobile.css
│   └── vendor/
│       └── plotly.min.js
└── .github/
    └── workflows/
        └── deploy-pages.yml
```

## Run locally

The application can be served by any static HTTP server. From the project directory, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

No Python packages are required. Python is only being used here as a convenient local static-file server.

## Deploy to GitHub Pages

1. Create a new public GitHub repository, for example `interactive-regression-likelihood`.
2. Copy the project files into the repository root.
3. Commit and push the files to the `main` branch.
4. In the GitHub repository, open **Settings**, then **Pages**.
5. Under **Build and deployment**, choose **GitHub Actions** as the source.
6. The included workflow will deploy the site automatically after every push to `main`.
7. After the workflow succeeds, GitHub will show the public Pages URL.

The deployment workflow requires no secrets and no paid hosting service.

## Interactions

- Drag **Intercept β₀** to translate every conditional mean by the same amount.
- Drag **Slope β₁** to rotate the regression line and move each conditional density according to its x-value.
- Drag **Standard deviation σ** to change the common spread and peak height of every conditional density.
- Change **Sample size n** from 14 to 200 observations. All predictor and outcome values are generated pseudorandomly from the selected seed. Predictor values are sampled from a finite grid, so repeated x-values can occur naturally.
- Change **Displayed density slices** from 4 up to the full sample size. Setting it equal to n displays one conditional-density profile per observation; profiles overlap when observations share the same x-value.
- Toggle residuals and density contributions.
- Select **Use MLE** to move the controls to the maximum-likelihood estimates for the fixed sample.
- Select **Generate a new fixed sample** to simulate another dataset.
- Switch to **Likelihood landscape** to see the current candidate relative to the MLE.
- Use **Export** to save the active chart as a high-resolution PNG image on larger screens.

## Mobile experience

On screens up to 820 pixels wide, the application uses a dedicated bottom control tray so the plot remains visible while β₀, β₁, and σ are dragged. The three primary model controls remain permanently available, while sample generation, density count, visual-layer switches, MLE controls, and model details are available through **More controls**.

The mobile presentation also:

- increases slider touch targets
- accounts for iPhone safe-area insets
- removes Plotly scroll zoom to avoid conflicts with page scrolling
- uses compact chart margins, axis labels, annotations, legends, and contour colorbars
- hides the Plotly mode bar and uses the application controls as the primary mobile interaction
- preserves the desktop and laptop layout unchanged

## Statistical interpretation

For each fixed predictor value x, the model assumes:

```text
Y | X=x ~ N(β₀ + β₁x, σ²)
```

The regression line connects the conditional means. Every displayed normal density is centered on that line. The amber segment represents the density assigned to the observed y-value at a selected x-value.

For independent observations, the log-likelihood is:

```text
ℓ(β₀, β₁, σ)
= -n/2 log(2πσ²)
  - 1/(2σ²) Σᵢ (yᵢ - β₀ - β₁xᵢ)²
```

Under normal homoskedastic errors, maximizing the likelihood with respect to β₀ and β₁ produces the ordinary least-squares estimates. The maximum-likelihood estimate of σ² divides the residual sum of squares by n.

## Implementation notes

- Sample generation uses a deterministic seeded pseudorandom number generator. "Deterministic" means reproducible for a given seed, not non-random: every observation receives a random predictor value and a random normal error draw.
- Predictor values are sampled from a finite grid between 0.5 and 9.5, which makes exact repeated x-values possible. Increasing n preserves the existing seeded observations and appends additional random observations.
- The sample-size control supports 14 through 200 observations, and the density-slice limit updates dynamically to equal n.
- OLS and the normal-regression MLE are calculated directly in JavaScript.
- The likelihood contour is generated from a precomputed residual-sum-of-squares grid for each fixed sample.
- Main-chart updates are coalesced to the browser refresh cycle with `requestAnimationFrame`.
- The heavier likelihood contour is updated only when its tab is active.
- `assets/mobile.js` applies mobile-only Plotly layout and interaction adaptations without changing the desktop rendering path.
- `assets/mobile.css` provides the fixed mobile control tray, expanded secondary controls, safe-area spacing, and larger touch targets.
- The application is responsive and includes keyboard-accessible native controls.

## License

This project is released under the MIT License.
