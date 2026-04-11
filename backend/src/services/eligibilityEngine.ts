import { fetchGovernmentSchemesCatalog } from "./governmentSchemeService";
import { FinancialUserProfile, GovernmentScheme } from "../utils/types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isLowIncome(incomeLevel: string): boolean {
  const level = normalize(incomeLevel);
  return ["low", "lower", "poor", "below poverty", "bpl", "very low", "marginal"].some((marker) =>
    level.includes(marker),
  );
}

export async function getEligibleSchemes(
  userProfile: FinancialUserProfile,
): Promise<{ schemes: GovernmentScheme[]; fetched_at: string; data_source: string; api_live: boolean }> {
  const eligibleNames = new Set<string>(["Soil Health Card"]);

  if (userProfile.landOwned) {
    eligibleNames.add("PM-KISAN");
    eligibleNames.add("Kisan Credit Card (KCC)");
  }

  if (normalize(userProfile.cropType).length > 0) {
    eligibleNames.add("PMFBY (Crop Insurance)");
  }

  if (isLowIncome(userProfile.incomeLevel)) {
    eligibleNames.add("NABARD Micro Loan");
  }

  const catalog = await fetchGovernmentSchemesCatalog();

  return {
    schemes: catalog.schemes.filter((scheme) => eligibleNames.has(scheme.name)),
    fetched_at: catalog.fetched_at,
    data_source: catalog.data_source,
    api_live: catalog.api_live,
  };
}
