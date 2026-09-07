# JPF outcomes: executed counterexample, completion and constrained search

Preview: `http://localhost:8787/pcd/cap-09-verifica.html#s6`, with runnable examples
and observations in sections 7–9. Production stays at `f0f4bde`.

## Corrections

The previous Mermaid diagram promised that all properties were verified, without
showing the distinction between complete and constrained exploration. Repeated
prose asserted that JPF always explored every execution and implied arbitrary LTL
support in core. The introductory table also put the validation question under
verification and treated testing as separate from all verification activities.

One shared-renderer SVG now distinguishes counterexample, complete-within-model
and inconclusive results. Scope includes input, configured properties, modeled
libraries and reductions. An invalid target or tool crash is not a target-program
counterexample. The diagram has seven nodes/six directed edges, fixed palette,
original embedded font and angular lines; concise node labels fit the desktop
column. Captions retain the qualifications. Browser Mermaid is no longer required.

The three-column introduction and tabs distinguish testing as an evidence-gathering
technique from verification against specification and validation against needs.
The JPF quiz answer and related model-checking paragraphs now scope their claims.
Arbitrary temporal properties require appropriate mechanisms/extensions; the
example explicitly checks deadlock and uncaught exceptions, including assertions.

## Actual toolchain and experiment

Pinned upstream checkout: `ee18da511fb59b8f19a23dd1240fbcc234afc420` from
`https://github.com/javapathfinder/jpf-core.git` under
`/tmp/notes-jpf-mzANAh/jpf-core`. It targets Java 11. Portable Temurin 11.0.32.1+1
is under `/tmp/notes-jpf-mzANAh/jdk-11.0.32.1+1`; no system JVM was installed.
The downloaded archive SHA-256
`5c3f68887c325d36d852ba534303e1f5f1f5cae7d6cc1e951d73e0d8e98a058d`
matches Adoptium API metadata, not an independent signature verification.

Built with Gradle wrapper 8.4, `--no-daemon --no-scan --max-workers=2 buildJars`,
using a temporary Gradle cache. Build scans were disabled. Upstream compilation
emits deprecation/unchecked notes; only the editorial Java sources are compiled
with `-Xlint:all -Werror`. BuildJars compiles upstream test sources but does not
run the complete upstream suite; no claim is made that it passed that suite.

`JpfCounter.java` is a real finite target with two threads, each doing one volatile
increment, followed by joins and an assertion of final value 2. The safe argument
protects the complete increment with one monitor; the unsafe argument does not.
`jpf-counter.jpf` uses DFSearch, explicit assertions/properties and FullStateSet
instead of compact hash signatures. This is exact matching of serialized states,
not a proof that every modeling abstraction captures real-world behavior.

Eight controlled executions are checked: the three documented RunJPF.jar commands,
plus five host-listener scenarios. Observations include:

- unsafe: an AssertionError with value 1 and a real counterexample trace;
- safe: search started/finished, no constraints and no property violation;
- unsafe with depth limit 1: both `no errors detected` and an actual depth-limit
  notification, hence inconclusive;
- absent target class: search never starts, hence not a successful verification;
- upstream `search.match_depth=true`: a reproduced ArrayIndexOutOfBoundsException
  from Search.setStateDepth on initial state -1, treated as a tool failure.

The documented examples retain default `search.match_depth=false`. This does not
turn the depth-limited run into a proof even below its limit; it remains explicitly
inconclusive. The external dependency was not patched to conceal its failure.

`JpfEvidence` listens to actual search lifecycle, constraint and property events.
Its classifier is scoped to these pinned DFSearch configurations with no external
termination or custom state filters. It is not a universal test for completeness
of arbitrary JPF extensions or interrupted processes. A zero process exit code is
not used as proof: even RunJPF with the lost-update assertion returns zero here.

The downloadable `jpf-results.json` records outcomes, compiler/revision and source
and configuration hashes. `jpf-content.cjs` verifies those hashes before generating
visible sources and the genuine HTML observation table. No test results are
invented from intended output. Detailed logs are in
`/home/ybc/notes-legacy-review-artifacts/jpf-*.log`.

## Reproduce

```sh
NOTES_JPF_CORE=/path/to/pinned/jpf-core NOTES_JDK11=/path/to/jdk11 node dev/legacy-diagrams/jpf-java-test.cjs
# To update recorded evidence deliberately, use --patch and apply_patch.
node dev/legacy-diagrams/jpf-content.cjs --check
node dev/legacy-diagrams/jpf-browser-test.cjs
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
node dev/legacy-diagrams/build.cjs --check
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Four 1280/390 px, JS/no-JS page views verify HTML5 parsing, unique IDs, no escaped
SVG elements, exact source/config/downloaded evidence, real result rows, image
loading and keyboard-scrolling regions. Four tab groups and eight quiz items
remain usable; all tab content remains visible without JS. Shared tests cover
SVG XML, geometry, text overlap, deterministic rendering, edge completeness,
font bytes/license and chapter drift. Actual desktop/mobile screenshots are
inspected; diagram labels were shortened to avoid desktop horizontal clipping.

## Sources and limits

- [Upstream JPF and build guidance](https://github.com/javapathfinder/jpf-core)
- [Default properties and modeled VM](https://github.com/javapathfinder/jpf-core/wiki/What-is-JPF)
- [Search strategies](https://github.com/javapathfinder/jpf-core/wiki/Search-Strategies)
- [Configuration](https://github.com/javapathfinder/jpf-core/wiki/Configuring-JPF)
- [Pinned lossless state set](https://github.com/javapathfinder/jpf-core/blob/ee18da511fb59b8f19a23dd1240fbcc234afc420/src/main/gov/nasa/jpf/vm/FullStateSet.java)
- [NASA verification activities](https://swehb.nasa.gov/spaces/7150/pages/16450546/SWE-067%2B-%2BVerify%2BImplementation)
- [NASA validation guidance](https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695440/SWE-055%2B-%2BRequirements%2BValidation)

The pinned Dockerfile/Compose were read: the image prepares tools and Compose
mounts the source, rather than image construction itself compiling JPF. The page
now states this accurately and uses `docker compose run --rm jpf-dev`; Docker was
not installed/run on the VPS. The course-specific labactivity03 repository was
not found in the inspected content tree, so its paths are not presented as tested.

Remaining PCD9 review includes general safety/liveness/fairness definitions, LTL
formulas and the existing state diagram, PROMELA/PlusCal snippets, counts of states,
fault/error/failure terminology and historical claims. This checkpoint does not
certify the whole chapter or site. No paid image generation, production deployment,
or edits to the preexisting root review/index and review/report changes.
