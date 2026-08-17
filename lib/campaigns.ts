/** Ordered newest → oldest. */
export const CAMPAIGNS = [
  "C7: July 2026 - June 2027",
  "C6: April - May 2026",
  "C5: Nov 2025 - May 2026",
  "C4: Aug - Sept 2025",
  "C3: June 2025",
  "C2: May - June 2025",
  "C1: April - May 2025",
] as const;

// C6 is the most recently completed campaign — C7 only started July 1st and has minimal data.
export const DEFAULT_CAMPAIGN = "C6: April - May 2026";

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
// TODO: confirm goals for C1-C6; using the C6 figures as a placeholder default.
const CAMPAIGN_GOALS: Record<string, Goals> = {
  "C7: July 2026 - June 2027": { impressions: 1_200_000, leads: 1_200 },
};

const DEFAULT_GOALS: Goals = { impressions: 300_000, leads: 300 };

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
