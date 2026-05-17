export const classifierConfig = {
  get provider(): string {
    return (process.env.CLASSIFIER_PROVIDER || "off").toLowerCase();
  },
  get model(): string {
    return process.env.CLASSIFIER_MODEL || "claude-haiku-4-5-20251001";
  },
  get dailyBudgetUsd(): number {
    const raw = process.env.CLASSIFIER_DAILY_BUDGET_USD ?? "5";
    const n = parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? n : 5;
  },
  get dedupeHours(): number {
    const raw = process.env.CLASSIFIER_DEDUPE_HOURS ?? "24";
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 24;
  },
  get hasApiKey(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  },
};
