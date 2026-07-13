(function () {
    "use strict";

    function initialize() {
        const seed = document.getElementById("sample-seed");
        const beta0 = document.getElementById("beta0-slider");
        if (!seed || !beta0) return;

        let previousSeed = seed.textContent;

        const observer = new MutationObserver(() => {
            const currentSeed = seed.textContent;
            if (currentSeed === previousSeed) return;

            previousSeed = currentSeed;
            beta0.dispatchEvent(new Event("input", { bubbles: true }));
        });

        observer.observe(seed, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    window.addEventListener("DOMContentLoaded", initialize);
}());
