# Interactive Regression Likelihood Explorer

A static, portfolio-ready web application for exploring maximum likelihood in a normal homoskedastic linear regression.

For a selected seed and sample size, the observed sample remains fixed while the user continuously changes:

- the intercept, β₀
- the slope, β₁
- the common conditional standard deviation, σ

The regression line, conditional normal densities, residuals, observation-level density contributions, log-likelihood, residual sum of squares, and likelihood landscape all respond immediately in the browser. The sample-size control can increase the fixed sample from 14 to 100 observations.

## Live application

[Open the live application](https://shakaarlatief.github.io/interactive-regression-likelihood/)

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
│   ├── favicon.svg
│   ├── style.css
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
- Change **Sample size n** from 14 to 100 observations. Increasing n preserves the existing seeded observations and adds new ones.
- Change **Displayed density slices** to control the visual detail without changing the likelihood calculation.
- Toggle residuals and density contributions.
- Select **Use MLE** to move the controls to the maximum-likelihood estimates for the fixed sample.
- Select **Generate a new fixed sample** to simulate another dataset while preserving the selected sample size.
- Switch to **Likelihood landscape** to see the current candidate relative to the MLE.
- Use **Export** to save the active chart as a high-resolution PNG image.

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

- Sample generation uses a deterministic seeded pseudorandom number generator, so the visualization is reproducible. The first 14 observations match the default sample, and larger sample sizes append deterministic observations without altering the existing points.
- OLS and the normal-regression MLE are calculated directly in JavaScript.
- The likelihood contour is generated from a precomputed residual-sum-of-squares grid for each fixed sample.
- Main-chart updates are coalesced to the browser refresh cycle with `requestAnimationFrame`.
- The heavier likelihood contour is updated only when its tab is active.
- The application is responsive and includes keyboard-accessible native controls.

## License

This project is released under the MIT License.
