// Translate presentation text only. API fields, source identifiers and links stay stable.
(function () {
  'use strict';
  const catalog = window.ATLAS_ID || {};
  const originals = new WeakMap();
  let language = 'id';
  try { language = localStorage.getItem('jakarta-atlas-language') || localStorage.getItem('jakarta-dashboard-lang') || 'id'; } catch {} // axiom-audit-ignore honesty -- Optional local preference persistence; current controls and source values remain available with explicit defaults.
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'id') language = query;
  try {if(window.parent&&window.parent!==window&&['id','en'].includes(window.parent.document.documentElement.lang))language=window.parent.document.documentElement.lang;}catch {} // Same-origin host language; standalone and external embeds retain their own preference.
  if (!['id', 'en'].includes(language)) language = 'id';
  const phrases = Object.keys(catalog).sort((a, b) => b.length - a.length);
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = new RegExp('(?<![\\p{L}\\p{N}])(?:' + phrases.map(escape).join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
  function translate(text) {
    if (language === 'en' || typeof text !== 'string') return text;
    const key = text.replace(/\s+/g, ' ').trim();
    if (Object.prototype.hasOwnProperty.call(catalog, key)) return text.replace(text.trim(), catalog[key]);
    return text.replace(parts, match => catalog[match]);
  }
  function update(node, attribute) {
    const value = attribute ? node.getAttribute(attribute) : node.nodeValue;
    if (!value) return;
    let record = originals.get(node);
    if (!record) { record = {}; originals.set(node, record); }
    const key = attribute || 'text';
    const prior = record[key];
    const original = prior && value === prior.last ? prior.original : value;
    const next = translate(original);
    record[key] = { original, last: next };
    if (value !== next) { if (attribute) node.setAttribute(attribute, next); else node.nodeValue = next; }
  }
  function visit(node) {
    if (node.nodeType === 3) { update(node); return; }
    if (node.nodeType !== 1 || node.hasAttribute('data-language-fixed') || /^(SCRIPT|STYLE|NOSCRIPT|CODE)$/.test(node.tagName)) return;
    ['aria-label', 'title', 'placeholder', 'alt'].forEach(attribute => { if (node.hasAttribute(attribute)) update(node, attribute); });
    for (const child of node.childNodes) visit(child);
  }
  function apply() {
    document.documentElement.lang = language;
    const select = document.getElementById('atlas-language');
    if (select) select.value = language;
    const dashboardLink=document.getElementById('atlas-dashboard-link');
    if(dashboardLink)dashboardLink.href='/?lang='+language;
    visit(document.body); visit(document.querySelector('title'));
    const description = document.querySelector('meta[name="description"]');
    if (description) update(description, 'content');
  }
  function set(value) {
    if (!['id', 'en'].includes(value)) return;
    language = value;
    try { localStorage.setItem('jakarta-atlas-language', value); localStorage.setItem('jakarta-dashboard-lang', value); } catch {} // axiom-audit-ignore honesty -- Optional local preference persistence; current controls and source values remain available with explicit defaults.
    if (window.history?.replaceState) {
      const url = new URL(window.location.href); url.searchParams.set('lang', value);
      window.history.replaceState(null, '', url.toString());
    }
    apply();
    window.dispatchEvent(new CustomEvent('atlas:language', { detail: value }));
  }
  document.documentElement.lang = language;
  document.documentElement.classList?.toggle("atlas-embedded", !!window.parent && window.parent !== window);
  window.AtlasLanguage = { translate, apply, set, language: () => language };
  document.addEventListener('DOMContentLoaded', function () {
    apply();
    document.getElementById('atlas-language')?.addEventListener('change', event => set(event.target.value));
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) visit(node);
        else if (record.type === 'attributes') update(record.target, record.attributeName);
        else visit(record.target);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'] });
  });
})();
