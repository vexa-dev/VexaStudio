export interface SegmentLayout {
  /** True when every value is 0: there is nothing to split. */
  empty: boolean;
  /** Relative flex weight per segment, same order as the input. */
  weights: number[];
}

const MIN_SHARE = 0.02;

/**
 * Pure layout for a segmented bar. Non-finite or negative values count as 0; each segment gets at
 * least 2% of the total so tiny values stay visible. With nothing to split, all weights are equal.
 */
export function segmentLayout(values: number[]): SegmentLayout {
  const clean = values.map((value) =>
    Number.isFinite(value) && value > 0 ? value : 0,
  );
  const total = clean.reduce((sum, value) => sum + value, 0);
  if (total === 0) return { empty: true, weights: clean.map(() => 1) };
  return {
    empty: false,
    weights: clean.map((value) => Math.max(value, total * MIN_SHARE)),
  };
}
