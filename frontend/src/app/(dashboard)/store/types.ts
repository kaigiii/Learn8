export interface CreditStoreTier {
  id: string;
  label: string;
  credits: number;
  note: string;
  badge?: string;
  variant: "starter" | "popular" | "pro";
}

export const CREDIT_STORE_TIERS: CreditStoreTier[] = [
  {
    id: "starter",
    label: "Quick Refill",
    credits: 500,
    note: "Good for a few course or hint actions",
    variant: "starter",
  },
  {
    id: "popular",
    label: "Builder Pack",
    credits: 2000,
    note: "Best for regular syllabus and lesson generation",
    badge: "Best Value",
    variant: "popular",
  },
  {
    id: "pro",
    label: "Studio Boost",
    credits: 5000,
    note: "High-credit sandbox refill for heavy testing",
    variant: "pro",
  },
];
