# Jakarta dashboard agent instructions

Read `README.md`, the latest entries in `context.md`, and `docs/ANTI-SLOP-DESIGN.md` before changes. Deploy this repository, not the archived sibling Jakarta atlas repository.

Apply the installed `anti-slop-design` skill before UI work. `npm run audit:design` is a mandatory part of `npm test`, CI and the canonical release. It checks objective contracts; it does not replace the required responsive screenshots and independent visual review. Preserve CTAN Universa for display and Source Sans 3 for reading, Palette 267, semantic map colours, all maps/canvases/charts and earned source data. Never reduce a file by more than 30% without owner approval. Keep credentials in the environment.

Use commit pathspecs and an `Agent: <name>` trailer. Done means commit, push, canonical `npm run release`, exact deployed bytes and live browser verification. Do not deploy uncommitted assets or use the old atlas checkout to deploy this Worker.
