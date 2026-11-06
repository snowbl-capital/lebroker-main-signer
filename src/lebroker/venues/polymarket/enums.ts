/** The commands the trader signs, by the name Polymarket gives them in a command's body and in what is signed. */
enum PolymarketOp {
  CREATE_PROXY = "createProxy",
  /** A proxy the owner no longer wants: signed by the owner's own key, as a command. */
  DELETE_PROXY = "deleteProxy",
  CREATE_ORDERS = "createOrders",
  CANCEL_ORDERS = "cancelOrders",
  UPDATE_LEVERAGE = "updateLeverage",
  UPDATE_MARGIN = "updateMargin",
  /** pUSD to another Perps account, which must exist: signed by the sending owner's own key. */
  INTERNAL_TRANSFER = "internalTransfer",
  /**
   * The most a builder's fee may take of each of the account's orders, at a version one past the last saved: signed by
   * the owner's own key. A most of 0 revokes it.
   */
  APPROVE_BUILDER = "approveBuilder",
}

export { PolymarketOp }
