import { z } from "zod"

/** A missing or malformed setting reads as empty and falls through to the next source. */
const setting = z.string().catch("")

const deploymentSettings = z
  .object({
    appUrl: setting,
    landingUrl: setting,
    apiUrl: setting,
    publicApiUrl: setting,
    lamargeUrl: setting,
    docsUrl: setting,
    walletConnectProjectId: setting,
    contactUrl: setting,
    hyperliquidAgentName: setting,
    asterAgentName: setting,
  })
  .catch({
    appUrl: "",
    landingUrl: "",
    apiUrl: "",
    publicApiUrl: "",
    lamargeUrl: "",
    docsUrl: "",
    walletConnectProjectId: "",
    contactUrl: "",
    hyperliquidAgentName: "",
    asterAgentName: "",
  })

export { deploymentSettings, setting }
