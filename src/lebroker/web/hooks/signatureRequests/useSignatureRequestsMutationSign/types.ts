import type { Attested } from "@lamarge/sdk/attestation"
import type { SignatureRequestView } from "../useSignatureRequestsQueryList/types"

/** A request, and the address of the wallet that signs it, which a venue's deposit address is read for; null for none. */
type DepositAddressOfProps = { request: Pick<SignatureRequestView, "venue" | "payload">; address: string | null }

type LighterAccountsOfProps = { request: Pick<SignatureRequestView, "kind" | "venue" | "payload"> }

type AttestedRequestProps = { payload: SignatureRequestView["payload"] }

/** `action`: what the allowlist read the request as; `attested`: LaMarge's attestation of it, verified, if it had one. */
type AttestedTakeProps = { action: string; attested: Attested | undefined }

/** A request, and the address that signs it, Main's: the one LaMarge's attestation must name. */
type AttestedOfProps = { request: Pick<SignatureRequestView, "kind" | "payload">; address: string }

export type { DepositAddressOfProps, LighterAccountsOfProps, AttestedRequestProps, AttestedTakeProps, AttestedOfProps }
