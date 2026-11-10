// Refuses a hand-run `wrangler deploy`. Wrangler runs this as [build].command.
if (process.env.RELEASE_GATE !== '1') {
  console.error('deploy refused: ship with `npm run release` (tests, spatial gate, lock, live audit). A hand deploy puts ungated bytes on the edge.');
  process.exit(1);
}
