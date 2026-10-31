/** Money is always integer paisa (1 PKR = 100 paisa). Never use floats for money. */
export type Paisa = number;

const PAISA_PER_RUPEE = 100;
const BP_DENOMINATOR = 10_000;

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer paisa amount, got ${value}`);
  }
}

/** Divide and round half away from zero, using integer-safe arithmetic on the numerator. */
function divRoundHalfUp(numerator: number, denominator: number): number {
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  return sign * Math.floor((abs * 2 + denominator) / (denominator * 2));
}

/** Rupees (possibly with decimals, e.g. user input) to paisa. */
export function toPaisa(rupees: number): Paisa {
  if (!Number.isFinite(rupees)) throw new RangeError('rupees must be a finite number');
  return Math.round(rupees * PAISA_PER_RUPEE);
}

export function fromPaisa(paisa: Paisa): number {
  assertInteger(paisa, 'paisa');
  return paisa / PAISA_PER_RUPEE;
}

export function addPaisa(...amounts: Paisa[]): Paisa {
  return amounts.reduce((sum, a) => {
    assertInteger(a, 'amount');
    return sum + a;
  }, 0);
}

/** Amount x rate in basis points (1% = 100 bp), rounded half up. */
export function bpOf(amount: Paisa, rateBp: number): Paisa {
  assertInteger(amount, 'amount');
  assertInteger(rateBp, 'rateBp');
  return divRoundHalfUp(amount * rateBp, BP_DENOMINATOR);
}

/** Amount x whole percent, rounded half up. */
export function percentOf(amount: Paisa, percent: number): Paisa {
  return bpOf(amount, percent * 100);
}

/** Round to the nearest multiple of `step` paisa (e.g. 500 = Rs 5). Step 0 means no rounding. */
export function roundToNearest(amount: Paisa, step: Paisa): Paisa {
  assertInteger(amount, 'amount');
  if (step === 0) return amount;
  assertInteger(step, 'step');
  return divRoundHalfUp(amount, step) * step;
}

const groupFormatter = new Intl.NumberFormat('en-US');

/** `Rs 1,250` (paisa shown only when non-zero: `Rs 1,250.50`). */
export function formatPkr(paisa: Paisa): string {
  assertInteger(paisa, 'paisa');
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / PAISA_PER_RUPEE);
  const rem = abs % PAISA_PER_RUPEE;
  const frac = rem === 0 ? '' : `.${String(rem).padStart(2, '0')}`;
  return `${paisa < 0 ? '-' : ''}Rs ${groupFormatter.format(rupees)}${frac}`;
}
