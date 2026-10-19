type Config = {
  /** The service's origin: its API is under `/api`. */
  lebrokerUrl: URL
  /** The folder of `<label>.key` files, `~` expanded. */
  keysDir: string
  /** The wallets to run, by label; null for every key file of the folder. */
  labels: readonly string[] | null
  /**
   * The chain the user's browser wallet usually shows: a venue's setup asked from the browser names it, and Hyperliquid's
   * rules accept it beside Arbitrum, as the browser does. Null: Arbitrum only. Sign-in names it too, Ethereum's when null.
   */
  chainId: number | null
}

type ReadConfigProps = { env: Readonly<Record<string, string | undefined>>; home: string }

type UrlProps = { raw: string }

type HostnameProps = { hostname: string }

type ExpandHomeProps = { path: string; home: string }

type LabelsProps = { raw: string }

type ChainIdProps = { raw: string }

export type { ChainIdProps, Config, ExpandHomeProps, HostnameProps, LabelsProps, ReadConfigProps, UrlProps }
