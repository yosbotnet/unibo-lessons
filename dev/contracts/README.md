# Offline smart-contract examples

DS-C4 sections 12–15 distinguish a platform's semantics from the slides' informal
taxonomy and historical syntax. The assets in `ds/assets/examples/` are the exact
sources compiled by these checks and downloadable from the chapter. They are
teaching fixtures, not contracts recommended for production or asset custody.

## Reproduce

```sh
cd dev/contracts
npm ci --ignore-scripts
node test.cjs
node sync.cjs                  # fails if code/table drift from executed results
node sync.cjs --patch          # prints a patch; apply through apply_patch
node browser-test.cjs          # uses existing local HTTP preview on port 8787
```

Browser checks use the pinned Playwright/Mermaid packages in `dev/legacy-diagrams`.
`NOTES_PREVIEW_URL` can select another local preview. No command above publishes,
uses a provider, calls an RPC endpoint, accesses a wallet, or submits a live
transaction. The synthetic signing keys have no purpose outside the in-memory VM.
The VM never connects to a blockchain. Browser tests serve CDN dependencies from
local files and abort external requests.

Solidity 0.8.36 and EthereumJS 10.1.3 are pinned; compiler target and VM hardfork
are explicitly Cancun, optimization disabled. This freezes the fixture, not a
claim to implement the latest network fork or quote a mainnet fee. Each signed
type-2 transaction is run against a synthetic block context. We test transaction
execution, not a chain of validated block headers or network consensus.

Five displayed transactions are actually executed:

- Counter `inc(0)` leaves zero; another sender's `inc(3)` leaves three and logs
  old values 0, 1, 2 with the actual immediate caller. The deployer getter does not
  impose authorization.
- `inc(1000)` with gas limit 50,000 reaches ten SSTORE and ten LOG1 step events,
  then runs out of gas. Counter remains three and receipt logs are empty.
- A child stores 99 and emits a log before REVERT. A high-level unhandled call
  rolls back parent and child, while a checked low-level call returns false and
  lets the parent store two and emit Continued(false). Separate parent instances
  begin at zero. Child changes/logs are discarded in both cases.
- All included transactions, including failures, consume a sender nonce. Sender
  balance reduction equals charged gas × 13 wei; the fee recipient receives
  gas × 3, leaving gas × 10 as the base component. REVERT cases use less than
  their allowance, whereas the top-level out-of-gas case consumes its full limit.
- An additional wrong-nonce transaction is rejected without changing sender
  balance/nonce or Counter state. Read-only getter probes are checkpointed and
  reverted so observation cannot alter the fixture.

The table is regenerated from the VM result, never edited numerically by hand.
No claims of a full Solidity security audit, arbitrary-contract verification,
proxy implementation verification or consensus simulation follow from these tests.

The initial compiler dependency brought a vulnerable old `tmp` version. A pinned
override to 0.2.7 removes the reported advisories; `npm audit` reports zero
vulnerabilities for this lockfile as checked on 7 September 2026. Lifecycle scripts
are disabled. These dependencies are development-only and not loaded by readers.

## Diagram and visual checks

`ds-contract-outcomes` uses the shared static Mermaid adapter in
`dev/legacy-diagrams/sources.cjs`, not hand-positioned SVG. Its eight nodes and nine
directed edges separate success, top-level REVERT and top-level out-of-gas, then
show the settlement effects that remain. Original IBM Plex Mono is embedded;
palette and angular links share the established renderer. Long explanations and
measured values stay in HTML rather than being compressed into the image.

The browser test checks HTML5 parse errors, escaped SVG-shape elements, duplicate
IDs, actual downloaded source bytes, rendered code and VM-derived table cells,
native image loading, all nine generation/challenge tabs, desktop/mobile page
bounds, keyboard scrolling of code/table/figure and no-JavaScript readability.
Screenshots and JSON reports go to `/home/ybc/notes-legacy-review-artifacts/`.

## Evidence and remaining work

Compared local DS C4 slide text under
`/home/ybc/content/exams/Distributed Systems/slides-text/`: taxonomy slide 124,
gas 146–148, Counter 151, limitations 158–165. Historical shorthand is labelled or
corrected, not treated as the specification of current Ethereum.

Primary references:

- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559): fee caps and settlement.
- [EIP-140](https://eips.ethereum.org/EIPS/eip-140): REVERT, rollback and unused gas.
- [Solidity exceptions](https://docs.soliditylang.org/en/latest/control-structures.html#error-handling-assert-require-revert-and-exceptions): call-frame failure and propagation.
- [Solidity security](https://docs.soliditylang.org/en/v0.8.36/security-considerations.html): public state, loop bounds and reentrancy.
- [OpenZeppelin proxies](https://docs.openzeppelin.com/upgrades-plugins/proxies): implementation code versus proxy state and upgrade obligations.
- [Ethereum oracles](https://ethereum.org/developers/docs/oracles/): off-chain data and randomness assumptions.
- [Ethereum EVM](https://ethereum.org/developers/docs/evm/): agreed state transitions.
- The installed EthereumJS VM README/API and the actual pinned compiler/runtime
  are used for the local fixture rather than a hand-written EVM imitation.

The later [foundation/hash-chain checkpoint](../legacy-diagrams/HASH-CHAIN.md)
addresses the earlier identity/membership, hash/timestamp, platform-example and
quiz 1–2 follow-up. It also replaces the final runtime Mermaid hash-chain. Neither
checkpoint certifies every possible protocol claim or the entire notes site.
Production is unchanged.
