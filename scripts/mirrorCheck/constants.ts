import type { MirroredFile } from "./types"

const SIGNABLE = "apps/web/src/helpers/signableRequest"

const WHOLE_SIGNABLE = [
  "constants.ts",
  "enums.ts",
  "errors.ts",
  "lamargeRules.ts",
  "setupRules.ts",
  "signableRequest.ts",
  "signableRequest.test.ts",
  "transferRules.ts",
  "types.ts",
  "utils.ts",
  "testing/fixtures.ts",
  "testing/types.ts",
].map(name => ({ mirror: `src/signableRequest/${name}`, source: `${SIGNABLE}/${name}`, whole: true }))

/** Every file this repository copies from lebroker, and where it comes from there (README.md, "Kept in sync with lebroker"). */
const MIRRORED_FILES: readonly MirroredFile[] = [
  ...WHOLE_SIGNABLE,
  ...["isRecord/isRecord", "shortAddress/shortAddress", "shortAddress/constants", "shortAddress/types"].map(name => ({
    mirror: `src/lebroker/core/helpers/${name}.ts`,
    source: `packages/core/src/helpers/${name}.ts`,
    whole: true,
  })),
  ...["typedValueWithIntegers", "constants", "types"].map(name => ({
    mirror: `src/lebroker/core/helpers/typedValueWithIntegers/${name}.ts`,
    source: `packages/core/src/helpers/typedValueWithIntegers/${name}.ts`,
    whole: true,
  })),
  ...["chainInfo", "types"].map(name => ({
    mirror: `src/lebroker/core/helpers/chainInfo/${name}.ts`,
    source: `packages/core/src/helpers/chainInfo/${name}.ts`,
    whole: true,
  })),
  ...["constants", "enums", "types"].map(name => ({
    mirror: `src/lebroker/core/chains/${name}.ts`,
    source: `packages/core/src/chains/${name}.ts`,
    whole: false,
  })),
  { mirror: "src/lebroker/core/enums.ts", source: "packages/core/src/enums.ts", whole: false },
  { mirror: "src/lebroker/core/constants.ts", source: "packages/core/src/constants.ts", whole: false },
  { mirror: "src/lebroker/accounts/enums.ts", source: "packages/accounts/src/enums.ts", whole: false },
  { mirror: "src/lebroker/accounts/constants.ts", source: "packages/accounts/src/constants.ts", whole: false },
  { mirror: "src/lebroker/accounts/types.ts", source: "packages/accounts/src/types.ts", whole: false },
  { mirror: "src/lebroker/accounts/grants/schema.ts", source: "packages/accounts/src/grants/schema.ts", whole: false },
  {
    mirror: "src/lebroker/accounts/signatureRequests/schema.ts",
    source: "packages/accounts/src/signatureRequests/schema.ts",
    whole: false,
  },
  {
    mirror: "src/lebroker/accounts/lighterKeyIndex/lighterKeyIndex.ts",
    source: "packages/accounts/src/lighterKeyIndex/lighterKeyIndex.ts",
    whole: false,
  },
  { mirror: "src/lebroker/accounts/lighterKeyIndex/types.ts", source: "packages/accounts/src/lighterKeyIndex/types.ts", whole: false },
  {
    mirror: "src/lebroker/accounts/typedDataFromWire/typedDataFromWire.ts",
    source: "packages/accounts/src/typedDataFromWire/typedDataFromWire.ts",
    whole: true,
  },
  { mirror: "src/lebroker/accounts/typedDataFromWire/types.ts", source: "packages/accounts/src/typedDataFromWire/types.ts", whole: true },
  ...["addressBookMessage", "addressBookMessage.test", "constants", "enums", "types"].map(name => ({
    mirror: `src/lebroker/accounts/addressBookMessage/${name}.ts`,
    source: `packages/accounts/src/addressBookMessage/${name}.ts`,
    whole: true,
  })),
  { mirror: "src/lebroker/signer/policy/enums.ts", source: "packages/signer/src/policy/enums.ts", whole: false },
  { mirror: "src/lebroker/signer/proof/constants.ts", source: "packages/signer/src/proof/constants.ts", whole: false },
  { mirror: "src/lebroker/signer/lighterPolicy/constants.ts", source: "packages/signer/src/lighterPolicy/constants.ts", whole: false },
  { mirror: "src/lebroker/signer/lamargePolicy/constants.ts", source: "packages/signer/src/lamargePolicy/constants.ts", whole: false },
  { mirror: "src/lebroker/venues/hyperliquid/constants.ts", source: "packages/venues/src/hyperliquid/constants.ts", whole: false },
  { mirror: "src/lebroker/venues/hyperliquid/enums.ts", source: "packages/venues/src/hyperliquid/enums.ts", whole: false },
  {
    mirror: "src/lebroker/venues/hyperliquid/agents/constants.ts",
    source: "packages/venues/src/hyperliquid/agents/constants.ts",
    whole: false,
  },
  { mirror: "src/lebroker/venues/aster/constants.ts", source: "packages/venues/src/aster/constants.ts", whole: false },
  ...["enums", "types"].map(name => ({
    mirror: `src/lebroker/venues/aster/${name}.ts`,
    source: `packages/venues/src/aster/${name}.ts`,
    whole: false,
  })),
  { mirror: "src/lebroker/venues/aster/labels.ts", source: "packages/venues/src/aster/labels.ts", whole: true },
  ...["agents", "types"].map(name => ({
    mirror: `src/lebroker/venues/hyperliquid/agents/${name}.ts`,
    source: `packages/venues/src/hyperliquid/agents/${name}.ts`,
    whole: false,
  })),
  ...["deploymentName", "types"].map(name => ({
    mirror: `src/lebroker/venues/helpers/deploymentName/${name}.ts`,
    source: `packages/venues/src/helpers/deploymentName/${name}.ts`,
    whole: true,
  })),
  { mirror: "src/lebroker/venues/constants.ts", source: "packages/venues/src/constants.ts", whole: false },
  { mirror: "src/lebroker/venues/gmx/constants.ts", source: "packages/venues/src/gmx/constants.ts", whole: false },
  { mirror: "src/lebroker/venues/gmx/relay/constants.ts", source: "packages/venues/src/gmx/relay/constants.ts", whole: false },
  { mirror: "src/lebroker/venues/polymarket/constants.ts", source: "packages/venues/src/polymarket/constants.ts", whole: false },
  ...["depositWallet", "enums", "signing", "types"].map(name => ({
    mirror: `src/lebroker/venues/polymarket/${name}.ts`,
    source: `packages/venues/src/polymarket/${name}.ts`,
    whole: false,
  })),
  ...["constants", "enums"].map(name => ({
    mirror: `src/lebroker/venues/lighter/${name}.ts`,
    source: `packages/venues/src/lighter/${name}.ts`,
    whole: false,
  })),
  {
    mirror: "src/lebroker/signer/depositAddresses/constants.ts",
    source: "packages/signer/src/depositAddresses/constants.ts",
    whole: true,
  },
  { mirror: "src/lebroker/web/schema.ts", source: "apps/web/src/schema.ts", whole: false },
  { mirror: "src/lebroker/web/types.ts", source: "apps/web/src/types.ts", whole: false },
  { mirror: "src/lebroker/web/enums.ts", source: "apps/web/src/enums.ts", whole: false },
  ...["constants", "schema"].map(name => ({
    mirror: `src/lebroker/web/config/runtime/${name}.ts`,
    source: `apps/web/src/config/runtime/${name}.ts`,
    whole: false,
  })),
  { mirror: "src/lebroker/web/helpers/sameAddress/sameAddress.ts", source: "apps/web/src/helpers/sameAddress/sameAddress.ts", whole: true },
  { mirror: "src/lebroker/web/helpers/sameAddress/types.ts", source: "apps/web/src/helpers/sameAddress/types.ts", whole: true },
  ...["sharedAccountName", "constants", "types"].map(name => ({
    mirror: `src/lebroker/web/helpers/sharedAccountName/${name}.ts`,
    source: `apps/web/src/helpers/sharedAccountName/${name}.ts`,
    whole: true,
  })),
  ...["venueDepositAddress", "venueDepositAddress.test", "enums", "schema", "types"].map(name => ({
    mirror: `src/lebroker/web/helpers/venueDepositAddress/${name}.ts`,
    source: `apps/web/src/helpers/venueDepositAddress/${name}.ts`,
    whole: true,
  })),
  ...["polymarketBridgeAddress", "polymarketBridgeAddress.test", "constants", "enums", "schema", "types"].map(name => ({
    mirror: `src/lebroker/web/helpers/polymarketBridgeAddress/${name}.ts`,
    source: `apps/web/src/helpers/polymarketBridgeAddress/${name}.ts`,
    whole: true,
  })),
  ...["lighterAccountAddresses", "lighterAccountAddresses.test", "constants", "enums", "schema", "types"].map(name => ({
    mirror: `src/lebroker/web/helpers/lighterAccountAddresses/${name}.ts`,
    source: `apps/web/src/helpers/lighterAccountAddresses/${name}.ts`,
    whole: true,
  })),
  ...["enums", "schema", "types"].map(name => ({
    mirror: `src/lebroker/web/hooks/bybitKey/useBybitKeyQuery/${name}.ts`,
    source: `apps/web/src/hooks/bybitKey/useBybitKeyQuery/${name}.ts`,
    whole: false,
  })),
  ...[
    { name: "utils", whole: false },
    { name: "types", whole: false },
    { name: "constants", whole: true },
    { name: "enums", whole: true },
  ].map(file => ({
    mirror: `src/lebroker/web/hooks/signatureRequests/useSignatureRequestsMutationSign/${file.name}.ts`,
    source: `apps/web/src/hooks/signatureRequests/useSignatureRequestsMutationSign/${file.name}.ts`,
    whole: file.whole,
  })),
  {
    mirror: "src/lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/schema.ts",
    source: "apps/web/src/hooks/signatureRequests/useSignatureRequestsQueryList/schema.ts",
    whole: true,
  },
  {
    mirror: "src/lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types.ts",
    source: "apps/web/src/hooks/signatureRequests/useSignatureRequestsQueryList/types.ts",
    whole: false,
  },
  {
    mirror: "src/lebroker/web/hooks/addressBook/useAddressBookQueryList/schema.ts",
    source: "apps/web/src/hooks/addressBook/useAddressBookQueryList/schema.ts",
    whole: true,
  },
  {
    mirror: "src/lebroker/web/hooks/accounts/useAccountsQueryList/schema.ts",
    source: "apps/web/src/hooks/accounts/useAccountsQueryList/schema.ts",
    whole: true,
  },
  {
    mirror: "src/lebroker/web/hooks/session/useSessionMutationSignIn/schema.ts",
    source: "apps/web/src/hooks/session/useSessionMutationSignIn/schema.ts",
    whole: true,
  },
  {
    mirror: "src/lebroker/web/hooks/session/useSessionMutationSignIn/constants.ts",
    source: "apps/web/src/hooks/session/useSessionMutationSignIn/constants.ts",
    whole: false,
  },
]

export { MIRRORED_FILES }
