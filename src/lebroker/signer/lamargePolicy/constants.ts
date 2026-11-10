/**
 * The most a LaMarge take may lose, in basis points of what it pays: what all its payments' deliveries bring back
 * together, both dollar stablecoins, is never less than what they pay together less this. lebroker's own moves stay
 * under it: the margin keeper's loses 1 % at most, its giving venue's fee counted (`MARGIN_MOVE_MAX_COST`), and a fund
 * move's LaMarge step half again its quote's cost (`LAMARGE_COST_SLACK`), so 1.5 % on a quote costing as much as the
 * keeper ever lets a move lose. LaMarge's recorded books and takes sit within 0.1 % of par. One constant for every
 * signer and the executor: the signer Lambda, Main's browser and Main's own signer hold a take to it, and the executor
 * refuses at plan, and asks LaMarge's `min_out` for at least, what they would refuse, before anything is withdrawn.
 */
const MAX_TAKE_LOSS_BPS = 150n

/**
 * The LaMarge venues lebroker's signers sign a take, a permit or a withdrawal for, by LaMarge's ids: those lebroker
 * trades. LaMarge's SDK pins more chains than these (GMX's, on Arbitrum), which no signer here pays from or delivers to.
 */
const LAMARGE_SIGNED_VENUES: ReadonlySet<string> = new Set(["hyperliquid", "polymarket", "aster", "lighter"])

export { MAX_TAKE_LOSS_BPS, LAMARGE_SIGNED_VENUES }
