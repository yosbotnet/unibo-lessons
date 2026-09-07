# Model error versus system impact

Both Cybersecurity chapter-05 versions now have a shared native flowchart and an
eight-row evidence table in section 8. The reworked chapter's opening CIA framing
and its CIA quiz were also corrected: a wrong label does not automatically mean
loss of availability, disclosure or physical harm. TOC anchors are preserved.

## Diagram contract

`impact-sources.cjs` defines the diagram in the existing Mermaid text notation.
The shared build-time renderer supplies the original embedded 14px IBM Plex Mono,
ivory/cobalt/vermilion palette, native SVG shapes and angular connectors. There
are no per-figure coordinates, hand-edited SVG paths or paid image calls.

Two paths distinguish physical manipulation followed by sensing from a direct
digital input change. Both reach preprocessing and the model. A dashed connector
marks the separate evidence needed to infer application behavior. The application
can reject/defer or accept an action; both branches reach outcome assessment.
The diagram is a conceptual evaluation structure, not a probability model,
an implementation of an attack or an assertion that human review guarantees safety.
Nine nodes and nine complete directed edges are checked. Prose stays in HTML;
the image and actual comparison table retain readable native sizes and support
keyboard scrolling on mobile.

## Source investigation and corrections

The source slide PDF is `/home/ybc/content/exams/Cybersecurity/AdvEx.pdf`.
Its extracted text omitted the crucial link destinations. To recover them:

```sh
pdftohtml -i -stdout /home/ybc/content/exams/Cybersecurity/AdvEx.pdf
```

This resolved “Ban”, “Zhou”, “Chen” and “Gazit”; a title search alone was insufficient.
The abbreviated Chen URL in the slides is broken; the actual CVPRW paper was
located by its full title. No claim is based only on a failed keyword search.

- [Eykholt et al., v5](https://arxiv.org/pdf/1707.08945v5), §§4–5 and Table 3:
  the 84.8% camouflage-art result concerns LISA-CNN classification of sampled,
  cropped drive-by frames, with Speed Limit 45 as target. It is not a crash
  probability or a test of transfer between automobile models. Table 3 was also
  visually inspected. The paper's separately constructed classifiers and attacks
  do not justify the former universal physical-versus-digital reliability ranking.
- [Sharif et al.](https://users.cs.northwestern.edu/~srutib/papers/face-rec-ccs16.pdf),
  §5.2/Table 2: printed-glasses physical tests involved three subjects. Dodging,
  impersonation and thresholded acceptance differ. Facial recognition and
  biometric authentication are related headings, not two independent datasets
  proving access violations or wrongful arrests.
- [Finlayson et al., v3](https://arxiv.org/pdf/1804.05296v3), §3: digital attacks
  on ResNet-50 models for retinal-image retinopathy, chest-X-ray pneumothorax and
  dermoscopic melanoma classification. The row does not invent an MRI tumor
  experiment or describe observed patient injury.
- [Grosse et al.](https://arxiv.org/pdf/1606.04435), §4: Android/DREBIN attacks
  restricted to additions of manifest-derived features. This must not be merged
  with [Ban et al. (2024)](https://www.techscience.com/CMES/v139n3/55641/html), a
  different Windows PE study. Ban's abstract gives detector-specific rates such
  as 65.6% and 99%; neither source establishes the slide's combined “Android APK,
  85%” experiment. The notes therefore retain the domain without this unsupported
  aggregate. No malware or evasion implementation was downloaded or executed.
- [Carlini & Wagner (2018)](https://nicholas.carlini.com/papers/2018_dls_audioadvex.pdf),
  §§III/V: direct digital, white-box DeepSpeech input; the generated examples did
  not survive over-the-air playback. Transferability was an open question. The
  slide's exact command substitution, commercial-assistant reach and intrusion
  narrative are not presented as measured outcomes.
- [Chen (2022)](https://openaccess.thecvf.com/content/CVPR2022W/ArtOfRobust/html/Chen_The_Risk_and_Opportunity_of_Adversarial_Example_in_Military_Field_CVPRW_2022_paper.html)
  presents conceptual military deception and simulations; [Gazit et al., v4](https://arxiv.org/abs/2512.20712v4)
  study RF/spectrogram drone detection, including physical transmission tests.
  These do not substantiate the slide's bus-to-convoy casualty story. The latter
  citation is explicitly v4 (2026), not silently treated as its 2025 first version.
- The slide's “Zhou 2023” hyperlink actually leads to [Zhu et al., TPatch](https://www.usenix.org/conference/usenixsecurity23/presentation/zhu).
  A printed patch is paired with acoustic-induced camera distortion. It does not
  disappear or receive a radio command. §6.2 explicitly limits evaluation to AI
  components and leaves closed-loop autonomous-system evaluation to future work.
  A sensor-triggered input manipulation must not be mistaken for demonstrated
  training-time poisoning or a reported traffic collision.

This revision does not assert that such downstream harms are impossible. It
separates possible consequences from the evidence actually supplied by these
experiments, and retains an exam prompt asking for that distinction.

## Reproduction and evidence checks

```sh
node dev/legacy-diagrams/impact-content.cjs
# Apply the printed chapter patch using apply_patch.
node dev/legacy-diagrams/impact-content.cjs --check
NOTES_IMPACT_EVIDENCE=/path/to/reviewed-evidence node dev/legacy-diagrams/impact-test.cjs
node dev/legacy-diagrams/impact-browser-test.cjs
node dev/legacy-diagrams/font-test.cjs
```

The evidence directory contains `eykholt.pdf`, `carlini.pdf`, `zhu.pdf`,
`chen.pdf`, and the full `ban.html` page from the URLs above. Exact PDF hashes:

- Eykholt: `fe6aba8e6913df2edc62061d686c87b103e2d65f68de4c38fe014272773e88d0`
- Carlini: `ef9346eb0f143fb73f62161a82e2ae985c3a92eeae0566bb92a19e0335481abc`
- Zhu: `7ffe5a6e22a41591db02c1bebfe842a28b0a645376652b3a461fc38c89fcf0d4`
- Chen: `c6e5b6206654d52fb42923ad904c4039a855b364c4efe79f3e61f9ff05f2d9c7`

The source test pins those PDFs and checks relevant passages, validates Ban's
parsed HTML, eight uniquely identified rows, references, removal of contradictory
claims, chapter markup and content idempotence. These are transcription and
integration checks, not replications of published experiments or proof from absence.

The browser suite checks deterministic SVG, XML, all nine edges, text bounds and
collisions, then both chapters at 1280/390/320px with JavaScript enabled/disabled.
It checks every evidence cell and link, actual font-sized images, table text
containment, figure/table keyboard scrolling, the new impact question, revised
CIA quiz, duplicate IDs and whole-page overflow/errors. Screenshots and reports
are in `/home/ybc/notes-legacy-review-artifacts/`. The font suite now includes 48
SVG assets. The new image is separate from the older 39-source migration registry.

The impact suite passed all twelve views. The feature regression also passed its
four plot variants and twelve chapter views on an isolated rerun; an earlier
parallel run ended with a closed-browser error, whose cause was not established.
The broader regression passed 26 desktop/mobile visits and 13 no-JavaScript pages,
including tabs and affected widgets. Impact, feature, transfer, FGSM and FGSM-result
content checks passed; the 48-asset font check passed too.

Preview: `http://localhost:8787/cybersecurity/Cyber-05-AI-Security.html#s8`
through the existing SSH tunnel; the reworked chapter uses the same anchor.

## Remaining scope

RL, model inversion/memorization, the later privacy taxonomy, LLM and agentic
claims still need review. The reworked CIA quiz now distinguishes goals from
outcomes but does not certify the later privacy discussion. The full-site
inventory has 315 pages and 1,013 figure elements; the original fifteen-course
scope remains 208 chapters and 882 figures. Counts are not completion evidence.
Existing audio may still contain superseded claims. Production and preexisting
root review/index/report edits remain untouched; deployment still needs approval.
