// THE ATLAS LAYOUT — assembled before the first paint.
//
// This block used to run at the end of app.js, which is a DEFERRED script:
// it ran after the HTML was parsed and after the map's client had begun, a
// third of a second after the page had already been painted. The atlas
// therefore existed in two states. The first state was the static markup —
// the City watch section where the markup put it, no tools row, no lens
// popup, the environment and data sections still standing below the map.
// The second state was the real page: one right-hand row of page-level
// doors over the map, the evidence popup on the lens strip, and every
// section carried into the "Data & sources" drawer.
//
// Two things were wrong with that, and both were measured rather than
// argued about.
//
// One: the reader saw the first state. For a quarter of a second the map
// had its own column of chrome that it does not have a moment later, and the
// page grew and shrank under them.
//
// Two: the spatial gate measured whichever state it happened to catch. The
// same build, swept twice, reported the City watch as a hole in one run and
// the tools row as a hole in the next, and a gate whose verdict flips on a
// coin is a gate nobody can read.
//
// So the layout is assembled here, in a classic script at the end of the
// body: it blocks parsing, runs before the first paint, and the page has
// exactly one state. The DOM it builds is the DOM a reader gets.
//
// The script is deliberately small and has no dependencies: it moves nodes
// and creates two of them. The map, the data and the translations are not
// its business, and none of them are its prerequisites.
(function () {
  'use strict';
  const embedded = window.parent !== window;
  document.body.classList.add('atlas-workbench');
  if (embedded) {
    document.body.classList.add('atlas-embedded');
    document.documentElement.classList.add('atlas-embedded-root');
  }
  // The three sections below the map live in the drawer from the first
  // paint; the stylesheet hides them where they stand until they are moved.
  const drawer = document.createElement('details');
  drawer.className = 'atlas-embedded-drawer';
  const summary = document.createElement('summary');
  summary.textContent = 'Data & sources';
  const body = document.createElement('div');
  body.className = 'atlas-embedded-evidence';
  for (const selector of (embedded ? ['.atlas-menu-body', '#atlas-environment', '#atlas-data', '.atlas-footer'] : ['#atlas-environment', '#atlas-data', '.atlas-footer'])) {
    const node = document.querySelector(selector);
    if (node) body.append(node);
  }
  drawer.append(summary, body);
  // The research page existed behind two clicks (Controls → How it is built) and
  // was the only page in the product nobody could reach from the map. It shares
  // the drawer's corner: one right-hand row, two page-level doors, and the row
  // was already occupied, so the map loses no height to it.
  const tools = document.createElement('div');
  tools.className = 'atlas-page-tools';
  const watch = document.getElementById('atlas-watch');
  if (watch) tools.append(watch);
  const researchLink = document.createElement('a');
  researchLink.className = 'atlas-research-link';
  researchLink.href = '/research';
  researchLink.textContent = 'Research & method';
  tools.append(researchLink, drawer);
  document.querySelector('.atlas-map-wrap').append(tools);
  const context = document.createElement('div');
  context.className = 'atlas-lens-context';
  context.append(document.getElementById('atlas-lens-title'), document.getElementById('atlas-lens-description'));
  const lensPopup = document.createElement('div');
  lensPopup.className = 'atlas-lens-popup';
  lensPopup.append(context, document.getElementById('atlas-lens-body'));
  document.getElementById('atlas-lens-evidence').append(lensPopup);
})();
