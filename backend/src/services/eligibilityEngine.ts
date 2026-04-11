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

function scoreScheme(scheme: GovernmentScheme, userProfile: FinancialUserProfile): number {
  const cropType = normalize(userProfile.cropType);

  switch (scheme.name) {
    case "Soil Health Card":
      return cropType ? 3 : 2;
    case "PM-KISAN":
      return userProfile.landOwned ? 5 : 0;
    case "Kisan Credit Card (KCC)":
      return userProfile.landOwned ? 4 + (isLowIncome(userProfile.incomeLevel) ? 1 : 0) : 0;
    case "PMFBY (Crop Insurance)":
      return cropType ? 5 : 0;
    case "NABARD Micro Loan":
      return isLowIncome(userProfile.incomeLevel) ? 5 : 0;
    default:
      return 0;
  }
}

export async function getEligibleSchemes(
  userProfile: FinancialUserProfile,
): Promise<{ schemes: GovernmentScheme[]; fetched_at: string; data_source: string; api_live: boolean }> {
  const catalog = await fetchGovernmentSchemesCatalog();
  const schemes = catalog.schemes
    .map((scheme) => ({
      scheme,
      score: scoreScheme(scheme, userProfile),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.scheme.name.localeCompare(right.scheme.name))
    .map(({ scheme }) => scheme);

  return {
    schemes,
    fetched_at: catalog.fetched_at,
    data_source: catalog.data_source,
    api_live: catalog.api_live,
  };
}
