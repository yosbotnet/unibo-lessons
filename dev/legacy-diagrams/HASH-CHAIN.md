# DS-C4 foundations: what hashes establish

The last runtime Mermaid in DS-C4 is replaced by `ds-hash-checkpoint`, a native
SVG using the existing angular-flow adapter, palette and embedded original font.
No raster generation, paid call or new runtime widget is involved. The page no
longer loads Mermaid; its existing PBFT, fork and hash-trial widgets remain.

## Reproduce

```sh
node dev/legacy-diagrams/hash-chain-traces.cjs          # generate JSON; print HTML patch
node dev/legacy-diagrams/hash-chain-traces.cjs --check  # check HTML/JSON drift
node dev/legacy-diagrams/build.cjs --patch              # native SVG + printed chapter patch
node dev/legacy-diagrams/build.cjs --check
node dev/legacy-diagrams/hash-chain-test.cjs
node dev/legacy-diagrams/test.cjs
node dev/legacy-diagrams/font-test.cjs
node dev/contracts/browser-test.cjs                    # HTML5 parsing and chapter regression
```

Apply printed patches with `apply_patch`; no generator publishes. Browser checks
use the existing localhost:8787 preview and pinned local dependencies. Reports
and screenshots are external to the checkout in
`/home/ybc/notes-legacy-review-artifacts/`.

## Model and source fidelity

`hash-chain.cjs` uses actual Node SHA-256, not illustrative hex. Each record hashes
the UTF-8 encoding of `["notes-hash-chain-v1", index, previousDigest, payload]`,
serialized by JSON.stringify with no trailing newline. The first predecessor
field is 64 zero hex digits. The cached digest is not included in its own input.
Payload text must be well-formed Unicode, at most 200 UTF-16 units; histories have
1–32 records. No implicit Unicode normalization is performed. A hex digest uses
64 lowercase characters; displayed abbreviations never participate in checks.

The diagram's three original records and two rewritten successors are derived
from the model's actual outputs. Its six edges show append order and comparison
with a saved head; they are not network messages or consensus-approved branches.
All full inputs and digests appear in HTML and in the downloadable
`ds/assets/examples/hash-chain.json`. Three standalone string-hash examples use
the actual shown text bytes; their surrounding display quotes are not hashed.

Three scenarios share one original `(length, head)` checkpoint:

| Scenario | Coherent | Head matches | Accepted |
| --- | --- | --- | --- |
| Original three-record history | yes | yes | yes |
| Change B1 payload only | no | yes | no |
| Change B1 and rebuild affected suffix | yes | no | no |

The middle case deliberately keeps B2 unchanged. B1's cached digest is stale and
B2's predecessor reference fails against B1's recomputed digest, although the
last digest still matches. Checking only the head is insufficient. The last case
passes every local check but not the original checkpoint. If an adversary can
replace the checkpoint as well, that comparison gives no independent protection.
Serving the example and its checkpoint together is explicitly **not** a real
independent trust channel. The fixed full-history checkpoint is not a protocol
for accepting legitimate append-only extensions; signatures, timing, consensus,
work and transaction validity are outside this model.

## Verification

- Two known SHA-256 vectors, newline sensitivity and distinct composed/decomposed
  Unicode inputs. 590 mutation/checkpoint cases over histories of length 1–16:
  every changed position, recomputation, malformed predecessor/cached hash/index,
  truncation, order changes and extension. Input objects remain unchanged.
- 944 distinct inputs checked independently with Chromium Web Crypto, including
  the actual displayed scenarios and three string examples. These are exact
  algorithm/input checks, not a proof of collision or preimage resistance.
- Native SVG: six nodes, six exact directed connections, deterministic output,
  XML validity, text bounds/collisions and complete real digest labels.
- Four HTTP views, desktop/mobile and JS/no-JS: all three details expand/collapse,
  exact full digest cells and downloadable JSON match the model, keyboard scrolling
  works, no Mermaid is requested and no page overflow remains.
- Visual inspection found excessively narrow digest columns on mobile; full-record
  tables now retain useful column widths and scroll horizontally, without reducing
  fonts. A separate no-JS overflow in the platform/standards tables was also fixed.
- The contracts browser suite parses the entire HTML with parse5, rejects stray
  SVG-only shapes in HTML and duplicate IDs, and checks source/code/result drift.
  Shared browser, PBFT and PoW/ledger regressions cover the unaffected widgets.

## Text/source corrections

Sections 1–4, 5 and 7 plus quiz 1–2 now distinguish shared state from simultaneous
updates, security assumptions from vocabulary, hashes from identity, and history
consistency from authority. Stateless services are allowed as the degenerate SMR
case. The whole state is not a single user/asset pair. Permissioned membership is
not defined by one mandatory CA; multiple addresses need not be unlinkable.

Local DS slide text was compared: architecture 21–23, hash chains/signatures
43–44, timestamp/notary 46–47 and user-identifier discussion. The architecture
source's Figure 1 was also visually inspected from PDF page 9: applications above
protocol above resources, with overlapping governance, operations and external
functions. Its PDF is retained among the external review artifacts, not copied
into the published site.

Primary evidence:

- [ITU FG DLT D3.1 (2019)](https://www.itu.int/en/ITU-T/focusgroups/dlt/Documents/d31.pdf): conceptual responsibilities, Figure 1, and the distinction between FG deliverables and ITU-T Recommendations.
- [ISO 22739:2024](https://www.iso.org/standard/82208.html): vocabulary reference/version, not a universal implementation guarantee.
- [NIST SHA standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) and [Digital Signature Standard](https://csrc.nist.gov/pubs/fips/186-5/final): primitives, not anonymous identities or real-world truth.
- [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161): signed time-stamp tokens and trust/clock/key assumptions, distinct from an event's actual occurrence time.
- [Ethereum accounts](https://ethereum.org/developers/docs/accounts) and [Fabric MSPs](https://hyperledger-fabric.readthedocs.io/en/latest/membership/membership.html): scoped identity examples; this chapter does not generalize the EOA derivation to contracts or all chains.
- [Corda architecture](https://docs.r3.com/en/pdf/corda-technical-whitepaper.pdf) and [5.2 notary protocol](https://docs.r3.com/en/platform/corda/5.2/developing-applications/ledger/notaries/non-validating-notary.html): dependency histories, validity versus uniqueness.
- [IOTA Rebased technical proposal](https://blog.iota.org/iota-rebased-technical-view/) and [5 May 2025 launch](https://blog.iota.org/builders-welcome-rebase-complete/): the earlier Tangle example must be dated, not presented as the unchanged current protocol.
- [Hedera Block Streams design](https://hedera.com/blog/introducing-block-streams-a-unified-data-stream-capturing-the-comprehensive-history-of-the-hedera-network/): consensus structure and hash-linked output are different layers. No operational cutover date or particular node migration status is asserted.

This resolves the previously listed DS-C4 foundation/hash-chain follow-up; it is
not certification of every ledger design, every source slide, or the full notes
site. Other runtime diagrams and unreviewed scientific content remain in scope.
The refreshed remaining-runtime scan finds 100 Mermaid diagrams on 31 pages;
both viewport passes render without reported syntax/geometry/page-overflow errors.
This only narrows the next review: it does not establish visual or scientific
correctness. The report is `audit-after-hash.json` in the external artifact directory.
Production is unchanged and deployment still requires approval.
