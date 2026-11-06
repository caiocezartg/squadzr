/**
 * How a period's total moved against the period before it:
 * - `up` / `down` / `flat`: both have a base, and `ratio` is the change (0.18 is 18%);
 * - `new`: nothing before and something now, where a percentage has no meaning;
 * - `none`: nothing in either period.
 */
export type PeriodChange =
  | { readonly trend: 'up' | 'down' | 'flat'; readonly ratio: number }
  | { readonly trend: 'new' | 'none' }

/** The change from `previous` to `current`. */
export function periodChange(current: number, previous: number): PeriodChange {
  if (previous === 0) return { trend: current > 0 ? 'new' : 'none' }

  const ratio = (current - previous) / previous
  if (ratio > 0) return { trend: 'up', ratio }
  if (ratio < 0) return { trend: 'down', ratio: -ratio }
  return { trend: 'flat', ratio: 0 }
}
