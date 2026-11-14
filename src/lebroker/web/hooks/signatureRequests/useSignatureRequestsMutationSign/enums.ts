// Why a request wasn't signed, before anything was sent.
enum SignRequestError {
  SIGNED_OUT = "Sign in before signing a request.",
  NOT_CONNECTED = "Your wallet isn't connected to this page: unlock it or connect it, then try again.",
  /** Only Main signs a request: the wallet must show it. Main's short address follows. */
  SHOW_MAIN = "Show your Main in your wallet to sign:",
  DECLINED = "You declined the signature in your wallet: nothing was sent.",
  /** Typed data is signed on the chain its domain names: wallets sign only on the chain they show. */
  /** The typed data names another chain than its allowlist's: the wallet is never switched to it. */
  NOT_ALLOWED_CHAIN = "This request names a chain leneutre never signs on: nothing was signed.",
  SWITCH_DECLINED = "Switch your wallet to the chain this request names to sign it: it's a signature, with no transaction and no gas. Nothing was sent.",
  /** The wallet couldn't add a network only to sign on: the network's name and chain id follow, then `SIGNING_NETWORK_HINT`. */
  SIGNING_NETWORK_REFUSED = "Your wallet couldn't add the network this request is signed on,",
  /** LaMarge's attestation the request carries doesn't verify against its deployment's attester, for Main, over this request. */
  NOT_ATTESTED = "LaMarge's attestation of this request doesn't hold: nothing was signed.",
  /** A take's payment LaMarge sent without its attestation, which both its deployments give every take. */
  UNATTESTED = "LaMarge didn't attest this take: nothing is signed without LaMarge's attestation.",
  SIGNING_NETWORK_HINT = "which only signs, with no transaction and no gas: sign it in a wallet that adds networks, such as MetaMask. Nothing was sent.",
}

export { SignRequestError }
