# Particle motion, wall geometry and worker-owned animation

Preview: `http://localhost:8787/pcd/cap-08-java.html#s15`.
Production remains at `f0f4bde`; no paid generation or service changes.

## What was corrected

The old Particle fragment was not compilable (undefined bounds/clamp), described
multiplicative damping as constant deceleration, scaled velocity by 0.98 per
callback regardless of dt, omitted radius and discarded wall overshoot by clamping.
It also said a bounce reversed the whole velocity vector.

The chapter now explicitly defines a linear-drag model, dv/dt = -k v, with seconds
and logical spatial units. The analytic travel integral and exponential speed
attenuation are combined with an unfolded/reflected rectangular path. Radius is
included in the center bounds, multiple crossings are preserved, and only the
normal component changes sign at an elastic wall. The code uses expm1 and a ratio
form that remains well behaved for tiny/subnormal drag values.

The model is deliberately specific: rectangular walls, restitution 1, uniform
linear drag, no gravity or inter-ball forces. Inputs are bounded to finite demo
values (world dimensions 1..1e6, at least one logical unit of center travel per
axis, speeds up to 1e6, drag 0..100, steps 0..60 seconds). No arbitrary velocity
cutoff or promise of numerical exactness for all real inputs.

Two canonical Java 17 downloads now cover the model and an actual three-ball GUI.
The worker owns the mutable particles; AtomicReference publishes immutable Frames
whose lists are defensively copied. A coalescing Swing timer reads these snapshots
on the EDT. Model steps use elapsed nanoTime, capped at 0.25 s after stalls, with
discarded time explicitly accumulated and displayed. This is animation policy,
not a hard-real-time simulator. Closing stops timer and worker without blocking EDT.
Uniform viewport scale preserves circles and separates logical coordinates from
window size. The GUI is not a speedup claim or one-thread-per-ball architecture.

## Native geometry illustration

`physics-plot.cjs` generates the SVG and its caption from a simple numeric fixture
without raster generation. The fixture is a single elastic wall hit with no drag:
A=(8,3), velocity=(5,2), radius=1 in a 10x10 arena. B=(9,3.4) at 0.2 s and
C=(5,5) at 1 s; final velocity=(-5,2). y grows downward as in the actual view.
Only B has a radius outline; the solid arrows follow the center trajectory.

The plot uses the shared ivory/cobalt/vermilion palette and exact embedded IBM
Plex Mono/font license. Native width 332 px fits the mobile content region with
the wrapper padding; no reduced font or hidden overflow. This geometric plot is
code-native rather than forced through a flowchart layout engine. It is verified
against the independently compiled Java fixture, including circle positions.

## Verification

```sh
NOTES_JDK=/path/to/jdk17 node dev/legacy-diagrams/physics-java-test.cjs
node dev/legacy-diagrams/physics-content.cjs --check
node dev/legacy-diagrams/physics-plot.cjs --check
node dev/legacy-diagrams/physics-browser-test.cjs
node dev/legacy-diagrams/executor-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
node dev/legacy-diagrams/build.cjs --check
NOTES_PREVIEW_URL=http://127.0.0.1:8787/ node dev/legacy-diagrams/browser-test.cjs
```

Compilation: JDK17, -Xlint:all -Werror. Each headless and Xvfb run tests 2,000
seeded cases against an independent event-by-event wall-collision oracle, not the
same modulo implementation. Also checks split versus single timesteps, radius
bounds, non-increasing speed, exact wall/corner hits, many crossings, dt=0,
subnormal drag, rejected dt/drag and reproduction of per-frame damping dependence.
The two runs pass 20,043 and 20,046 checks respectively.

Manual-clock engine tests verify elapsed time, the explicit lost-time policy,
snapshot immutability and no steps after close. Swing tests paint model centers
and arena edges at three aspect ratios, verify actual worker progression/exit,
timer shutdown and rejection of EDT blocking waits. The real main window is
opened, captured, then closed through WINDOW_CLOSING. A visual inspection found
inherited ImageObserver WIDTH/HEIGHT constants masking the world dimensions;
WORLD_WIDTH/WORLD_HEIGHT and an edge-pixel regression test fix that actual bug.

Browser checks: 1280/390 px with JS on/off, source/download identity, HTML5 parsing,
unique IDs, no SVG elements escaped to HTML, actual SVG XML, label bounds/overlap,
determinism, Java-to-plot numeric identity, image loading and keyboard scrolling.
Existing PCD8 widgets are tested separately. Native plot, responsive chapter/code
and the actual Java window were visually inspected. Artifacts live under
`/home/ybc/notes-legacy-review-artifacts/physics-*`, not in the public asset set.

## Evidence and remaining scope

The local transcript `PCD-2026-03-20.md` under
`/home/ybc/content/exams/Programmazione Concorrente e Distribuita (PCD)/transcripts/`
describes a larger game with players, pockets, score, ball mass/radius, friction
and restitution. The original game source was not found in the inspected content
tree. The text now distinguishes that game from this editorial motion/boundary
example; it does not claim to implement or certify the complete assignment.
`[Lab Notes] GUI Frameworks and Concurrency.txt`, slide 12, motivates ownership
and active-component separation. API references:
[Swing Timer](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/javax/swing/Timer.html),
[elapsed nanoTime](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/System.html#nanoTime()),
[Swing threading policy](https://docs.oracle.com/en/java/javase/17/docs/api/java.desktop/javax/swing/package-summary.html).

No exhaustive floating-point/scheduler proof, inter-particle collision solver,
hard latency guarantee or certification of the entire chapter/site. The full-site
review remains active. Preexisting root review/index and review/report changes
are preserved and unstaged.
