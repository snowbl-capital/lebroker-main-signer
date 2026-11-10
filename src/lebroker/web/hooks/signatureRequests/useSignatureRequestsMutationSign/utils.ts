import { ATTESTERS, verifyAttestation, type Attested, type SignRequest } from "@lamarge/sdk/attestation"
import { SignaturePayloadKind, SignatureRequestKind, typedDataFromWire } from "../../../../accounts/model"
import { ChainId, VenueId } from "../../../../core/model"
import { ARBITRUM_USDC } from "../../../../venues/model"
import { polymarketBridgeAddress } from "../../../helpers/polymarketBridgeAddress/polymarketBridgeAddress"
import { LIGHTER_TRANSFER_MESSAGE } from "../../../../signer/model"
import { lighterAccountAddresses } from "../../../helpers/lighterAccountAddresses/lighterAccountAddresses"
import { LAMARGE_DEPLOYMENTS, POLYMARKET_PERPS_WITHDRAW_TYPE } from "../../../../../signableRequest/constants"
import type { ReadDepositAddress } from "../../../../../signableRequest/types"
import { venueDepositAddress } from "../../../helpers/venueDepositAddress/venueDepositAddress"
import { ATTESTED_TAKE_ACTIONS } from "./constants"
import { SignRequestError } from "./enums"
import type { AttestedOfProps, AttestedRequestProps, AttestedTakeProps, DepositAddressOfProps, LighterAccountsOfProps } from "./types"

/**
 * For Main's withdrawal straight into a venue's deposit address for Main, that address, read by the browser itself
 * from the venue the request names, for the address of the wallet that signs, just before it signs, and for one through
 * Polymarket's bridge, the address the bridge answers the browser as paying it; nothing for any other request. A read that fails, or a wallet that shows no address, throws: nothing is signed.
 */
async function depositAddressOf({ request, address }: DepositAddressOfProps): Promise<ReadDepositAddress | undefined> {
  const venue = request.payload.depositVenue
  // Main's Perps margin withdrawn to its own Deposit Wallet first: no deposit address of the venue's in it.
  const toWallet =
    request.payload.kind === SignaturePayloadKind.TYPED_DATA && request.payload.typedData.primaryType === POLYMARKET_PERPS_WITHDRAW_TYPE
  if (venue === undefined || toWallet) {
    return undefined
  }
  if (address === null) {
    throw new Error(SignRequestError.NOT_CONNECTED)
  }
  const deposit = await venueDepositAddress({ venue, address })
  if (request.venue !== VenueId.POLYMARKET_PERPS) {
    return { venue, address: deposit }
  }
  // Paid through Polymarket's bridge: the address it pays the deposit address from, asked by the browser itself.
  const payTo = await polymarketBridgeAddress({
    main: address,
    recipient: deposit,
    chainId: ChainId.ARBITRUM,
    token: ARBITRUM_USDC.address,
  })
  return { venue, address: deposit, payTo }
}

/**
 * For Main's Lighter transfer, the L1 address that owns each Lighter account its owner message names, read by the
 * browser itself from Lighter just before it signs: Lighter names them by index alone. Nothing for any other request;
 * a read that fails throws: nothing is signed.
 */
async function lighterAccountsOf({ request }: LighterAccountsOfProps): Promise<ReadonlyMap<number, string> | undefined> {
  const payload = request.payload
  // Main's transfer to a sub-account, or its fast withdrawal, a transfer to Lighter's pool.
  if (
    (request.kind !== SignatureRequestKind.TRANSFER && request.kind !== SignatureRequestKind.WITHDRAWAL) ||
    request.venue !== VenueId.LIGHTER ||
    payload.kind !== SignaturePayloadKind.PERSONAL_MESSAGE
  ) {
    return undefined
  }
  const read = LIGHTER_TRANSFER_MESSAGE.exec(payload.message)
  if (read === null) {
    return undefined
  }
  return await lighterAccountAddresses({
    indexes: [Number.parseInt(read[2] ?? "", 16), Number.parseInt(read[3] ?? "", 16)].filter(index => Number.isSafeInteger(index)),
  })
}

/**
 * The request as Main's wallet signs it, in the shape LaMarge's attestation is checked over: the message, or the typed
 * data with its integers bigints again and its domain's chain id a number. A domain without its name or chain id, or with
 * a salt, is no LaMarge request: refused.
 */
function attestedRequest({ payload }: AttestedRequestProps): SignRequest {
  if (payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE) {
    return { message: payload.message }
  }
  const typed = typedDataFromWire({ payload: payload.typedData })
  const domain = typed.domain
  if (domain?.name === undefined || domain.chainId === undefined || domain.salt !== undefined) {
    throw new Error(SignRequestError.NOT_ATTESTED)
  }
  return {
    domain: {
      name: domain.name,
      chainId: Number(domain.chainId),
      ...(domain.version === undefined ? {} : { version: domain.version }),
      ...(domain.verifyingContract === undefined ? {} : { verifyingContract: domain.verifyingContract }),
    },
    types: Object.fromEntries(Object.entries(typed.types).map(entry => [entry[0], [...entry[1]]])),
    primaryType: typed.primaryType,
    message: typed.message,
  }
}

/**
 * For a LaMarge request LaMarge attests, its attestation verified by the browser itself against the pinned attester of
 * the deployment the request is for, over the exact request Main's wallet would sign, for Main's own address: what the
 * allowlist then holds a take's deliveries to. Nothing for a request that carries none; one that doesn't verify throws,
 * and nothing is signed.
 */
async function attestedOf({ request, address }: AttestedOfProps): Promise<Attested | undefined> {
  const payload = request.payload
  if (payload.attestation === undefined) {
    return undefined
  }
  const deployment = LAMARGE_DEPLOYMENTS.find(own => own.appOrigin === payload.lamarge?.appOrigin)
  if (request.kind !== SignatureRequestKind.LAMARGE_MOVE || deployment === undefined) {
    throw new Error(SignRequestError.NOT_ATTESTED)
  }
  return await verifyAttestation({
    request: attestedRequest({ payload }),
    address,
    attestation: payload.attestation,
    attesters: ATTESTERS[deployment.environment],
  }).catch((error: unknown) => {
    // LaMarge's own words stay out of the page; which check refused is for whoever looks at the console.
    console.warn(error)
    throw new Error(SignRequestError.NOT_ATTESTED)
  })
}

/**
 * A LaMarge take's payment is signed only with LaMarge's attestation of it, verified: both deployments attest every take,
 * so one without is refused, as LaMarge says a signer that requires attestations does. Every other request goes on its
 * own checks.
 */
function checkAttestedTake({ action, attested }: AttestedTakeProps): void {
  if (attested === undefined && ATTESTED_TAKE_ACTIONS.has(action)) {
    throw new Error(SignRequestError.UNATTESTED)
  }
}

export { depositAddressOf, lighterAccountsOf, attestedRequest, attestedOf, checkAttestedTake }
