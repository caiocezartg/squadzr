/**
 * Time source injected into every lifecycle decision and write. Production
 * wires a system clock; tests wire a fixed clock so expiration and limit
 * cutoffs are asserted at exact instants instead of by sleeping.
 */
export interface Clock {
  now(): Date
}
