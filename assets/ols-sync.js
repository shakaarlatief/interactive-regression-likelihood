(function () {
    "use strict";

    function initialize() {
        const seed = document.getElementById("sample-seed");
        const beta0 = document.getElementById("beta0-slider");
        if (!seed || !beta0) return;

        const observer = new MutationObserver(() => {
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
