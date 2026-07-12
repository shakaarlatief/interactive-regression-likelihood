# Interactive Regression Likelihood Explorer

An interactive, browser-based visualization of maximum likelihood estimation in a normal homoskedastic linear regression.

The application keeps the observed sample fixed while the user changes the intercept, slope, and common conditional standard deviation. The regression line, conditional normal densities, residuals, observation-level density contributions, likelihood metrics, and likelihood landscape update immediately.

## Live application

[Open the Interactive Regression Likelihood Explorer](https://shakaarlatief.github.io/interactive-regression-likelihood/)

## Purpose

The project is designed to make the geometry and probability model behind linear-regression maximum likelihood visually intuitive.

For each fixed predictor value \(x_i\), the model assumes a conditional normal distribution centered at

$$
E[Y_i \mid X_i=x_i] = \beta_0 + \beta_1 x_i.
$$

Changing the regression coefficients shifts the centers of all conditional distributions simultaneously. Changing \(\sigma\) changes their spread and peak height without changing their centers.

The observed data remain fixed throughout this process. Only the candidate probability model changes.

## Main interactions

- Drag **Intercept \(\beta_0\)** to translate every conditional mean by the same amount.
- Drag **Slope \(\beta_1\)** to rotate the regression line and move each conditional density according to its predictor value.
- Drag **Standard deviation \(\sigma\)** to change the common conditional spread.
- Increase **Sample size \(n\)** from 14 to 200 observations.
- Increase **Displayed density slices** up to the full sample size.
- Toggle residuals and observation-level density contributions.
- Select **Use MLE** to move the controls to the maximum-likelihood estimates for the current sample.
- Generate a new fixed random sample while retaining reproducibility through a seed.
- Switch to the **Likelihood landscape** to compare the current candidate coefficients with the MLE.
- Export the active chart as a high-resolution PNG on larger screens.

## Statistical model

The conditional model is

$$
Y_i \mid X_i=x_i \sim \mathcal{N}(\beta_0 + \beta_1 x_i, \sigma^2).
$$

For independent observations, the log-likelihood is

$$
\ell(\beta_0,\beta_1,\sigma)
=
-\frac{n}{2}\log(2\pi\sigma^2)
-\frac{1}{2\sigma^2}
\sum_{i=1}^{n}
\left(y_i-\beta_0-\beta_1x_i\right)^2.
$$

Under normal homoskedastic errors, maximizing the likelihood with respect to \(\beta_0\) and \(\beta_1\) gives the ordinary least-squares estimates. The maximum-likelihood estimator of the error variance is

$$
\hat\sigma^2_{\mathrm{MLE}}
=
\frac{1}{n}
\sum_{i=1}^{n}
\hat e_i^2.
$$

The application calculates these quantities directly in JavaScript and updates them continuously as the candidate parameters move.

## What the visualization shows

### Conditional-distribution view

Each sideways profile is the conditional density of \(Y\) at one fixed predictor value. Its center lies on the regression line. The amber segment shows the density assigned to the observed outcome at that predictor value.

This makes it possible to see that:

- changing \(\beta_0\) shifts all conditional means equally
- changing \(\beta_1\) affects observations differently depending on their predictor values
- changing \(\sigma\) changes both density spread and peak height
- observations with large residuals receive lower density under the candidate model
- the joint likelihood is built from all observation-level density contributions

### Likelihood-landscape view

The contour plot displays the log-likelihood over intercept and slope values for the current \(\sigma\). The MLE and the current candidate parameter values are shown simultaneously.

## Random sample generation

Every observation receives:

- a pseudorandom predictor value sampled from a finite grid between 0.5 and 9.5
- an independent pseudorandom normal error draw

Because predictor values are sampled from a finite grid, repeated \(x\)-values can occur naturally.

The generator is deterministic only in the reproducibility sense: the same seed produces the same random sample. The observations are still randomly generated.

Increasing the sample size preserves the existing seeded observations and appends additional observations from the same random sequence.

## Technical design

The application is fully static and runs entirely in the browser.

- **HTML** provides the application structure.
- **CSS** provides the desktop and mobile layouts.
- **Vanilla JavaScript** performs sample generation, MLE calculations, likelihood calculations, and interaction handling.
- **Plotly.js** renders the regression, density, residual, contribution, and likelihood visualizations.
- **GitHub Actions** deploys the application automatically to GitHub Pages after updates to `main`.

There is no Python server, backend process, database, API key, or paid hosting dependency.

Continuous slider movement is handled with the browser `input` event. Plot updates are coordinated with `requestAnimationFrame`, while the heavier likelihood contour is updated separately so it does not interfere with the main animation.

## Mobile experience

On screens up to 820 pixels wide, the application uses a compact bottom control tray so the plot remains visible while \(\beta_0\), \(\beta_1\), and \(\sigma\) are adjusted.

The mobile interface also includes:

- larger slider touch targets
- iPhone safe-area support
- an expandable **More controls** panel
- compact chart margins, labels, legends, and annotations
- disabled Plotly scroll zoom to avoid conflicts with normal page scrolling
- a hidden Plotly mode bar so the model controls remain the primary interaction

## Run locally

No package installation is required. From the repository root, start any static HTTP server, for example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Python is used only as a convenient static-file server in this command. The application itself does not depend on Python.

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

## License

This project is released under the MIT License.
