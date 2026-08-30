// Chart constants, kept out of Charts.jsx so that file exports only components.

/**
 * Reserved status meanings for booking state. These are deliberately NOT
 * colourblind-separable from each other on their own — the mitigation is that
 * every status colour in this panel is rendered beside its written Arabic label
 * and its number, never as colour alone.
 */
export const STATUS_COLORS = {
  pending: '#fab219',
  confirmed: '#2a78d6',
  completed: '#0ca30c',
  cancelled: '#d03b3b',
  no_show: '#ec835a',
}

export const BRAND = '#0D7A5F'

// Latin digits: Arabic-Indic numerals read badly beside the Latin figures used
// for ids, coordinates and prices elsewhere in the panel.
const nf = new Intl.NumberFormat('ar-SA-u-nu-latn')
export const formatNumber = (n) => nf.format(n ?? 0)
