/**
 * Net Positive Suction Head Available — the one balance.
 *
 *     NPSHa = staticHead + pressureHead − vaporPressureHead − frictionLoss
 *
 * Every term is a head in **metres of the pumped liquid**, not of water: the
 * caller converts its pressures with `barToHead(pressure, density)` at the
 * density it actually computed. Mixing a head of water into a brine balance is
 * a ~3% error that no steady-state check would catch.
 *
 * ── Why this is its own function ─────────────────────────────────────────
 * Two calculators had this identical line, and a third (the MED brine and
 * distillate holdup drums) was about to. They differ in what they sweep and in
 * how good their friction number is — not in the physics — so the sweep stays
 * with each caller and only the balance lives here (rule 32):
 *
 *   flashChamberCalculator   sweeps 3 liquid levels (LG-L / operating / LG-H),
 *                            friction is a flat estimate
 *   suctionSystemCalculator  sweeps 2 strainer conditions (clean / dirty),
 *                            friction is Darcy-Weisbach + K-factors over the
 *                            real pipe run
 *
 * ── Sign convention ──────────────────────────────────────────────────────
 * `staticHead` is the liquid surface elevation MINUS the pump centreline, so it
 * goes negative when the pump sits above the liquid — a suction lift. That is a
 * legitimate result, not an error to clamp: a negative NPSHa is the calculation
 * telling you the pump will cavitate. Nothing here floors, clamps or otherwise
 * flatters the number, because a guard published as a physical result is worse
 * than a wrong one — a consumer cannot tell it was ever applied.
 *
 * ── The saturated-vessel case ────────────────────────────────────────────
 * When a vessel holds liquid at its own saturation temperature — a flash
 * chamber, or any drum under vacuum — the vapour pressure equals the vessel
 * pressure, so `pressureHead − vaporPressureHead` is ~0 and NPSHa collapses to
 * `staticHead − frictionLoss`. The two terms are still computed and published
 * separately rather than cancelled here: publishing the components is what lets
 * a consumer attribute a disagreement instead of merely observing one, and the
 * cancellation stops being exact the moment the liquid is subcooled or carries
 * a boiling point elevation.
 */

/** The four heads the balance is made of, all in metres of the pumped liquid */
export interface NPSHaTerms {
  /** Liquid surface elevation − pump centreline; negative means suction lift */
  staticHead: number;
  /** Vessel pressure above the liquid, as head */
  pressureHead: number;
  /** Vapour pressure of the liquid at pumping temperature, as head */
  vaporPressureHead: number;
  /** Friction and fitting losses in the suction line, as head (always positive) */
  frictionLoss: number;
}

/** The terms, plus the number they sum to */
export interface NPSHaResult extends NPSHaTerms {
  /** Net positive suction head available, m of liquid */
  npsha: number;
}

/**
 * Sum the NPSHa balance.
 *
 * Returns the terms alongside the result so a caller can publish the
 * composition without recomposing it from its own locals — two copies of the
 * same quantity is how they start to disagree.
 */
export function computeNPSHa(terms: NPSHaTerms): NPSHaResult {
  const { staticHead, pressureHead, vaporPressureHead, frictionLoss } = terms;

  return {
    ...terms,
    npsha: staticHead + pressureHead - vaporPressureHead - frictionLoss,
  };
}

/**
 * Margin of available over required suction head.
 *
 * NPSHr comes from the pump's datasheet; NPSHa is what the process offers. The
 * pump is safe when the margin covers the safety allowance, so a positive
 * margin alone is not the test — `margin >= safetyMargin` is.
 */
export function npshMargin(npsha: number, pumpNPSHr: number): number {
  return npsha - pumpNPSHr;
}
