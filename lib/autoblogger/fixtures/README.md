# Offline integration fixture

Run from the autoblogger repository:

```sh
pnpm exec vitest run lib/autoblogger/offline-e2e.test.ts
```

Two drafting rejection cases always run without a lander checkout. The two native
integration cases use `AUTOBLOG_NATIVE_LANDER_PATH`, or automatically detect the
local sibling `../videoclaw-lander-blog-launch` when the variable is unset. Only
an absent optional sibling skips those two cases. An explicitly configured empty
or missing path, or a checkout with missing dependencies/assets, fails the tests.

For CI, install the lander dependencies first, then run:

```sh
AUTOBLOG_NATIVE_LANDER_PATH=/absolute/path/to/lander pnpm exec vitest run lib/autoblogger/offline-e2e.test.ts
```

The path must contain a git checkout with `app/lib/articles.ts`, `package.json`,
`package-lock.json`, and `public/landing/full/founder-product.mp4` and `.jpg`.
Its installed `node_modules` must contain gray-matter, mdast-util-to-string,
remark-gfm, remark-parse, unified, zod, react, react-dom, react-markdown and eslint,
with their transitive dependencies. Tests do not install into or edit that checkout.

Each native case creates a temporary git repository and copies the **unmodified
production `articles.ts`** plus the two product media assets into it. The real
publisher clones it, writes generated Markdown/SVG, and executes these commands:

| Command | What actually runs |
| --- | --- |
| `npm ci` | Real npm, with a generated lock of local file dependencies, an isolated cache and `offline=true`; no downloads. |
| `npm run check:blog` | A fixture script calling the copied native `getAllArticles`/`getVisibleArticles` contract. This is not the native lander's whole `check:blog` test suite. |
| `npm run lint` | Real ESLint over fixture scripts, using the fixture config. |
| `npm run build` | A small static build rendering Markdown through React Markdown and checking production visibility. This is **not** the lander's native Next.js build. |

The test also submits malformed Markdown and requires the native article validator
to fail. Publisher reports are never fabricated. GitHub calls fail at the boundary;
research, provider, source-safety, drafting, publisher and file-state implementations
are real. Only HTTP/DNS and structured model output are deterministic fixtures.
Draft prose paraphrases independently worded observed search titles/snippets; critic
and repair verification return explicit support coverage for the supplied binding
manifest. Reachability does not claim that source page bodies were used as evidence.

All temporary fixtures are deleted by default. To retain **one** successful generated
bundle for a separate full native lander CLI validation, opt in:

```sh
AUTOBLOG_NATIVE_LANDER_PATH=/absolute/path/to/lander \
AUTOBLOG_E2E_OUTPUT_DIR="$PWD/artifacts/autoblogger/final-qa" \
pnpm exec vitest run lib/autoblogger/offline-e2e.test.ts
```

The production artifact writer exports `founder-video-workflow-49.bundle.json`, its
`.publication.json` origin envelope, `.md`, `.svg`, and `run-report.json`. The report
counts describe the complete successful three-artifact run; only its first artifact
is retained. No native schema or dependency tree is copied into this repository.
