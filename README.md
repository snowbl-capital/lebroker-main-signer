# lebroker Main signer

Signs, on its user's own machine, the signature requests lebroker's hosted service asks of their **Main** wallets, and only those lebroker's allowlist accepts. Everything else is left for the user to sign or not in the browser.

lebroker's hosted service never holds a Main wallet's key (HOSTED_SERVICE.md, D2): what its delegated keys can't sign becomes a signature request, which the web app's banner shows and the user signs in their browser wallet. This program is the optional piece D1 left for later, automatic signing for Main, in a first, simple version:

- **Local.** It runs on the user's machine, with their keys in a folder there. The keys never leave it.
- **Allowlist only.** It signs exactly what the web app would let the browser wallet sign (D43), with the same rules, copied from lebroker (below). Nothing is signed blind.
- **Several wallets.** One process signs for every Main wallet whose key file is in the folder, each under its own session.

It is its own repository, published at github.com/snowbl-capital/lebroker-main-signer. It copies the code it shares with lebroker until that code lives in a shared package (below, "Kept in sync with lebroker").

## What it signs, and what it refuses

For each waiting request of each wallet, it reads the user's accounts again from the service, then runs the allowlist (`src/signableRequest`, lebroker's `apps/web/src/helpers/signableRequest`):

| Request                            | Signed only when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A venue's setup or renewal on Main | Hyperliquid: lebroker's named agent (`lebroker valid_until …`), 180 days at most, on mainnet, on Arbitrum or the chain `MAIN_CHAIN_ID` names. Aster: lebroker's agent, perps only, never Spot, never withdrawals, 180 days at most, for this Main. Polymarket Perps: lebroker's proxy, a week at most. Lighter: Main's proof of its own account for its own account, a day at most; a key registration at lebroker's indexes, 200 to 253, only.                                                                                                                                                                                                                                         |
| A transfer from Main               | Hyperliquid's `sendAsset` of USDC between the spot balance and the main dex's perps, or Aster's Spot transfer of USDT, to one of the user's own **open sub-accounts** as the service lists them now. Polymarket's hashed commands are refused: they can't be read before they're signed.                                                                                                                                                                                                                                                                                                                                                                                                |
| A withdrawal                       | Hyperliquid's `withdraw3` or Aster's withdrawal, to **Main's own address** only. One exception, which opens Main's Lighter from inside lebroker (lebroker's D56): Hyperliquid's `withdraw3` whose request names Lighter (`depositVenue`), on mainnet, of 6 USDC at least, to **Main's own Lighter intent address as this signer reads it itself from Lighter** just before it signs (`createIntentAddress`, for Arbitrum and the signing wallet's own address, 5 seconds at most, no redirect), never an address the request names alone. When that read fails, nothing is signed.                                                                                                      |
| A payment for gas                  | Hyperliquid's `sendAsset` of USDC from Main's own balances, on mainnet, on Arbitrum or the chain `MAIN_CHAIN_ID` names, $20 at most, to **lebroker's gas reserve as pinned for the deployment `LEBROKER_URL` names** (`GAS_RESERVE_DEPLOYMENTS`, by its origin), never an address the request names alone. Only dev's is pinned for now: production, and any other deployment, a local stack's included, pin none, and nothing of this kind is signed there. The chain the gas is for is the service's word, shown in the summary only.                                                                                                                                                 |
| A LaMarge move                     | Only what LaMarge's own SDK (`@lamarge/sdk`) checks, held to the deployment the request names, production's or dev's: a permit to that deployment's escrow, a payment into it whose deliveries come from it too, a take paid inside Aster or Lighter to the maker of the take the request carries and nobody else (`checkAsterTakeIntent`, `checkLighterTakeIntent`), by that deployment's Lighter key, a refund of Main's own payment from its escrow, a withdrawal back to Main, LaMarge's Aster agent under that deployment's name, LaMarge's Lighter key at that deployment's index on Main's own Lighter account as the request names it, Main's sign-in on that deployment's app. |
| Main's account mode                | Hyperliquid's `userSetAbstraction` (lebroker's D66), on mainnet, on the chain `MAIN_CHAIN_ID` names or one lebroker signs on: for **Main's own address** only, never one of its Hyperliquid sub-accounts, and to `unifiedAccount` only, never portfolio margin or standard again, with a nonce no more than an hour past when the request was asked, by the request or by this signer's own clock, whichever is earlier. Its summary says it switches Main's Hyperliquid account to unified mode. Its kind, `account-mode`, is one lebroker doesn't ask yet (below).                                                                                                                    |

Each kind has its exact signing domain and types; anything else is refused: an unknown kind, venue, domain, type or field, a chain the kind doesn't name, a request for another account than Main, a destination that isn't one of the user's accounts (or, for a payment for gas, the reserve pinned for the deployment), an approval that lasts too long. Typed data is signed only on the chain the allowlist returns.

A refused request is **never signed**. The signer logs `refused` with the allowlist's reason, once per request, tells lebroker with `POST /api/v1/signature-requests/<id>/decline` and that reason, and leaves it waiting for the user in the browser, where lebroker offers it at once and tells the user's channels. It checks it again on later passes, silently, in case the user's accounts change (a sub-account opening, for instance), and tells lebroker again each time its event stream opens again: lebroker keeps what it was told in memory only.

It also leaves alone what the user chose to put off (Later, a `deferred` request) and what has expired.

## How it works

Per wallet:

1. **Sign-in, as the web app does.** `POST /api/v1/session/nonce`, then a Sign-In with Ethereum message naming the service's own host (`LEBROKER_URL`'s), the web's statement and a 5-minute expiry, signed with the wallet's key, then `POST /api/v1/session`. The message also names the resource `urn:lebroker:main-signer`: signed with the rest, it makes the session the signer's, and lebroker counts the signer as connected while that session's event stream is open. Meanwhile the web app asks nothing of the browser for the requests the signer signs, and the user's channels aren't asked for them either. The session lives in its cookie (`lebroker_session`, or `__Host-lebroker_session` over https). A call answered 401 signs in again once and is sent again. Changes carry the service's own `Origin`, as the browser's do. The session lebroker answers must name this wallet's own address, its user's and its own: every rule that names Main's own address reads it from there, so a session naming another is refused, and nothing is signed on it.
2. **Watching.** `GET /api/v1/events`, the event stream the web app subscribes to: each `signature-requests` event starts a pass. While the stream is down, a pass runs every 5 seconds; while it's up, every minute anyway. A dropped stream is opened again after 1 second, doubling up to 30.
3. **A pass.** `GET /api/v1/signature-requests`, then for the waiting ones `GET /api/v1/accounts`, the allowlist, the signature, and `POST /api/v1/signature-requests/<id>/sign` with `{ signature }`.
4. **Failures.** When the service or its venue fails (no answer, or 5xx), the signature is sent again on the next passes, 3 times in all. When the service refuses it (4xx: already settled, not Main's, refused by the venue), the signer stops there and logs why.

## Running it locally

With [Bun](https://bun.sh) 1.4 or later:

```sh
bun install
MAIN_KEYS_DIR=~/wts LEBROKER_URL=http://127.0.0.1:8190 bun run main-signer
```

Ctrl+C stops it.

| Variable        | Default             | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEBROKER_URL`  | required            | The lebroker service's address, such as `http://127.0.0.1:8190` for the local stack's executor. Plain `http` is refused unless the host is this machine (`localhost`, `127.x.x.x`, `::1`): the session cookie and Main's signatures cross the wire. Use `https` for any other host. Its origin also names the deployment the allowlist signs for, as the page's own does in the browser: a payment for gas goes only to the reserve pinned for it. |
| `MAIN_KEYS_DIR` | required            | A folder of key files, one per Main wallet, each named `<label>.key`, with its key inside: 32 bytes in hex, with or without `0x`. The file's name is the wallet's label in the logs. A leading `~` is the home folder.                                                                                                                                                                                                                             |
| `MAIN_WALLETS`  | all of the folder's | The wallets to run, by label, separated by commas: `main,sec`.                                                                                                                                                                                                                                                                                                                                                                                     |
| `MAIN_CHAIN_ID` | none                | The chain your browser wallet usually shows. A venue setup asked from the browser names it, and Hyperliquid's rules accept it beside Arbitrum, as the browser does. Sign-in messages name it too (Ethereum's id otherwise).                                                                                                                                                                                                                        |

The key folder follows the rules of lebroker's former `WALLET_KEYS_DIR`. Other files and hidden ones are left alone. The start stops on a malformed key, two files of one wallet, or a folder with no key file. It also stops on a key file its group or others can read (`chmod 600` it); that check is skipped on Windows, where a file's access list, not its permission bits, says who reads it. Errors name a file by its label, never by its key or its path. Unlike the executor, there's no cap on the number of wallets: the executor's cap came from venue connections, and this signer opens none.

Each wallet must be one that signs in to lebroker (a plain key, an EOA), and its user must be able to sign in there.

## Logs

One JSON line per event on standard output: `time`, `event`, the wallet's `wallet` (label) and `address`, and for a request its `requestId`, `kind` and `venue`.

| `event`              | Fields                                                                      |
| -------------------- | --------------------------------------------------------------------------- |
| `started`, `stopped` |                                                                             |
| `session`            | `stage`: `signed-in` or `renewed`                                           |
| `session-failed`     | `error`                                                                     |
| `stream`             | `stage`: `connected` or `dropped`                                           |
| `read-failed`        | `subject` (`signature-requests`, `accounts`, `events`), `error`             |
| `signed`             | `action`, decoded from what was signed, and `chainId`                       |
| `refused`            | `reason`, the allowlist's                                                   |
| `failed`             | `step` (`sign`, `send` or `decline`), `error`, `status`, `attempt`, `retry` |

A log line never holds a key, a signature or a request's payload. The keys stay in a private field (`WalletKey`) that no log, JSON or inspection shows.

## Kept in sync with lebroker

The allowlist and the shapes around it are copied from lebroker, at commit `48c8398bfbb7fe246d84eca912d76286d3e839aa` (24 October 2026, LaMarge's escrows and slots held to each request's deployment, lebroker PR #460), but for the accounts list's `shared` field (D55), which the signer doesn't read yet. Each copied declaration reads word for word as its source's; only the imports differ, rewritten to this repository's paths. A file copied whole keeps every declaration of its source; another keeps only those the signer needs.

`bun run mirror:check <path to a lebroker checkout>` compares them all with that checkout and lists every difference. Run it whenever lebroker's allowlist changes, and copy the change here.

**Ahead of lebroker: Main's account mode (D66).** This signer holds a rule lebroker's allowlist doesn't have yet: Main's Hyperliquid account switched to unified mode, under a request kind of its own, `account-mode`. lebroker doesn't ask it yet. Its browser allowlist and its `SignatureRequestKind` are to take the same declarations, word for word. Until then `mirror:check` lists these differences, and no other is to be left:

- `src/signableRequest/enums.ts`: `SignableRefusal` (`NOT_UNIFIED`), `SignSummaryText` (`UNIFY_HYPERLIQUID`), `SignSummaryLabel` (`ACCOUNT`);
- `src/signableRequest/signableRequest.ts`: `accountModeSummary`, and `summaryOf`'s case for it;
- `src/lebroker/accounts/enums.ts`: `SignatureRequestKind` (`ACCOUNT_MODE`).

The rule itself is in `src/signableRequest/accountModeRules.ts` and its tests in `accountMode.test.ts`, which lebroker is to take whole. `HyperliquidAbstraction` and `USER_SET_ABSTRACTION_TYPES` are copied from lebroker's `packages/venues/src/hyperliquid/` as they are.

| Here                                                                                             | lebroker                                                                                                                                        | Copied                                                                |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/signableRequest/*.ts`, `testing/fixtures.ts`, `testing/types.ts`, `signableRequest.test.ts` | `apps/web/src/helpers/signableRequest/`                                                                                                         | whole                                                                 |
| `src/lebroker/core/helpers/{isRecord,shortAddress,typedValueWithIntegers}/`                      | `packages/core/src/helpers/`                                                                                                                    | whole                                                                 |
| `src/lebroker/core/helpers/chainInfo/`                                                           | `packages/core/src/helpers/chainInfo/`                                                                                                          | whole                                                                 |
| `src/lebroker/core/bridges/{constants,enums,types}.ts`                                           | `packages/core/src/bridges/{constants,enums,types}.ts`                                                                                          | `CHAINS`, `ChainId`, `ChainInfo`                                      |
| `src/lebroker/core/enums.ts`                                                                     | `packages/core/src/enums.ts`                                                                                                                    | `Network`, `VenueId`                                                  |
| `src/lebroker/accounts/enums.ts`                                                                 | `packages/accounts/src/enums.ts`                                                                                                                | the account, user and signature-request enums                         |
| `src/lebroker/accounts/constants.ts`                                                             | `packages/accounts/src/constants.ts`                                                                                                            | `LIGHTER_KEY_INDEX`, `LIGHTER_LAST_KEY_INDEX`, `MAIN_SIGNER_RESOURCE` |
| `src/lebroker/accounts/types.ts`                                                                 | `packages/accounts/src/types.ts`                                                                                                                | `TypedDataPayload`, `SignaturePayload`, `GasPurchaseContext`          |
| `src/lebroker/accounts/signatureRequests/schema.ts`                                              | `packages/accounts/src/signatureRequests/schema.ts`                                                                                             | `typedDataPayload`, `signaturePayload`, `gasPurchaseContext`          |
| `src/lebroker/accounts/lighterKeyIndex/`                                                         | `packages/accounts/src/lighterKeyIndex/`                                                                                                        | `isLighterKeyIndex`                                                   |
| `src/lebroker/accounts/typedDataFromWire/`                                                       | `packages/accounts/src/typedDataFromWire/`                                                                                                      | whole                                                                 |
| `src/lebroker/signer/policy/enums.ts`                                                            | `packages/signer/src/policy/enums.ts`                                                                                                           | `AsterParam`, `AsterBoolean`                                          |
| `src/lebroker/signer/proof/constants.ts`                                                         | `packages/signer/src/proof/constants.ts`                                                                                                        | the proof's domain and Lighter proof types                            |
| `src/lebroker/signer/lighterPolicy/constants.ts`                                                 | `packages/signer/src/lighterPolicy/constants.ts`                                                                                                | `REGISTRATION_MESSAGE`, `TRANSFER_MESSAGE`                            |
| `src/lebroker/signer/depositAddresses/constants.ts`                                              | `packages/signer/src/depositAddresses/constants.ts`                                                                                             | whole                                                                 |
| `src/lebroker/venues/{hyperliquid,aster,polymarket}/constants.ts`                                | `packages/venues/src/…/constants.ts`                                                                                                            | the signing domains, types and limits                                 |
| `src/lebroker/venues/hyperliquid/enums.ts`                                                       | `packages/venues/src/hyperliquid/enums.ts`                                                                                                      | `HyperliquidAbstraction`                                              |
| `src/lebroker/venues/lighter/constants.ts`                                                       | `packages/venues/src/lighter/constants.ts`                                                                                                      | `API_URL`                                                             |
| `src/lebroker/web/schema.ts`, `types.ts`                                                         | `apps/web/src/schema.ts`, `types.ts`                                                                                                            | `sessionUser`, `accountView` and their types                          |
| `src/lebroker/web/helpers/sameAddress/`                                                          | `apps/web/src/helpers/sameAddress/`                                                                                                             | whole                                                                 |
| `src/lebroker/web/helpers/venueDepositAddress/`                                                  | `apps/web/src/helpers/venueDepositAddress/`                                                                                                     | whole                                                                 |
| `src/lebroker/web/hooks/…/schema.ts`                                                             | `apps/web/src/hooks/{signatureRequests/useSignatureRequestsQueryList,accounts/useAccountsQueryList,session/useSessionMutationSignIn}/schema.ts` | whole                                                                 |
| `src/lebroker/web/hooks/…/types.ts`, `constants.ts`                                              | the same hooks' `types.ts`, `constants.ts`                                                                                                      | the list's types; the sign-in's statement and lifetime                |

The `model.ts` files under `src/lebroker/` re-export these under the names lebroker's packages give them (`@lebroker/venues/model` and the like).

Written after lebroker's code, not checked by `mirror:check`:

- `src/wallets/`: the key folder's rules, from `apps/executor/src/wallets/wallets.ts` on lebroker's `main` (`d64dfb79`), with `MAIN_KEYS_DIR` in its messages and no cap on the number of wallets.
- `src/api/`: the routes and session cookie names of `apps/executor/src/app/{enums,constants}.ts`, and the sign-in of `apps/web/src/hooks/session/useSessionMutationSignIn/utils.ts`.
- `src/signPayload/`: the web's `signPayload` (`apps/web/src/hooks/signatureRequests/useSignatureRequestsMutationSign/utils.ts`), without the browser wallet's connection and chain switch.
- `src/walletSigner/utils.ts`'s `createDepositAddressReader`: the web's `depositAddressOf` (`apps/web/src/hooks/signatureRequests/useSignatureRequestsMutationSign/utils.ts`), for the signing wallet's own address, read only for Hyperliquid's `withdraw3` naming a venue `WITHDRAWAL_DEPOSIT_MIN_USD` lists. An answer is kept 30 seconds; a failed read (a 429 or a 418 among them) pauses the reads 2 minutes. A failed or paused read gives no address, which the allowlist refuses, where the web throws.
- `src/helpers/formatDate/`: the design system's `formatDate`, in its English locale (`en-GB`), which the allowlist's summaries use.
- `src/helpers/formatUsd/`: the design system's `formatUsd` at its defaults (cents, a plain $ sign), in the same locale, for the payment for gas's summary.
- `src/signableRequest/testing/builders/`: what `@lebroker/venues/model`'s request builders build, for the copied tests, from the copied domains and types.

## Developing

```sh
bun run check      # ESLint, Prettier, typecheck, tests
bun run format     # fixes the formatting
```

The code follows lebroker's conventions (its CONTRIBUTING.md): one object parameter typed `…Props`, braces on every `if`, enums for known values and messages, each folder's types, enums and constants in their own files, no `!`. ESLint enforces them.

The tests need no network and no real key. They run the signer against a fake of lebroker's service (`src/testing/fakeApi`), which checks sign-ins and signatures as the service does, with keys generated for each test.
