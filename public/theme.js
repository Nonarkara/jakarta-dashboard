// Jakarta coastal/Betawi warm–cool relationship from Palette 267. Three reading conditions, one layout.
(function () {
  "use strict";
  const themes = ["dark", "light", "contrast"];
  let selected;
  try { selected = localStorage.getItem("jakarta-atlas-theme"); } catch (e) {} // axiom-audit-ignore honesty -- Optional local preference persistence; current controls and source values remain available with explicit defaults.
  if (!themes.includes(selected)) {
    selected = window.matchMedia("(prefers-contrast: more)").matches ? "contrast"
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function apply(theme, persist) {
    if (!themes.includes(theme)) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
    if (persist) { try { localStorage.setItem("jakarta-atlas-theme", theme); } catch (e) {} } // axiom-audit-ignore honesty -- Optional local preference persistence; current controls and source values remain available with explicit defaults.
    const select = document.getElementById("atlas-theme");
    if (select) select.value = theme;
    window.dispatchEvent(new CustomEvent("atlas:theme", { detail: theme }));
  }
  apply(selected, false);
  document.addEventListener("DOMContentLoaded", function () {
    const select = document.getElementById("atlas-theme");
    if (!select) return;
    select.value = document.documentElement.dataset.theme;
    select.addEventListener("change", function () { apply(select.value, true); });
  });
})();
