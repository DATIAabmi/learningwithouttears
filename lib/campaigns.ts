/** Ordered newest → oldest. */
export const CAMPAIGNS = [
  "C1: August - November 2026",
] as const;

export const DEFAULT_CAMPAIGN = "C1: August - November 2026";

/** Strips the "C#: " prefix to get a display-friendly date range. */
export function campaignDateRange(campaign: string): string {
  return campaign.replace(/^C\d+:\s*/, "");
}

interface Goals {
  impressions: number;
  leads: number;
}

// Per-campaign impression/lead goals — campaigns run for different lengths
// of time so a single fixed goal doesn't apply across all of them.
const CAMPAIGN_GOALS: Record<string, Goals> = {
  "C1: August - November 2026": { impressions: 200_000, leads: 200 },
};

const DEFAULT_GOALS: Goals = { impressions: 200_000, leads: 200 };

/**
 * Goals for the selected campaign(s), summed when multiple are selected.
 * An empty selection ("All campaigns") sums every known campaign's goal.
 */
export function campaignGoals(selected: string[]): Goals {
  const campaigns = selected.length > 0 ? selected : [...CAMPAIGNS];
  return campaigns.reduce(
    (acc, c) => {
      const g = CAMPAIGN_GOALS[c] ?? DEFAULT_GOALS;
      return { impressions: acc.impressions + g.impressions, leads: acc.leads + g.leads };
    },
    { impressions: 0, leads: 0 }
  );
}
