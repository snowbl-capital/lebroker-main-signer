/** The design system's `formatUsd` at its defaults: dollars with a plain $ sign, whatever the locale's own, in cents. */
const USD_FORMAT: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

export { USD_FORMAT }
