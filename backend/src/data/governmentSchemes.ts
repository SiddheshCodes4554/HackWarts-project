import { GovernmentScheme } from "../utils/types";

export const GOVERNMENT_SCHEMES: GovernmentScheme[] = [
  {
    name: "PM-KISAN",
    benefit: "₹6000 per year in 3 installments",
    eligibility: [
      "Small and marginal farmers",
      "Must have cultivable land",
      "Valid Aadhaar linked bank account",
    ],
    documents: ["Aadhaar", "Bank Account", "Land Records"],
    apply_steps: [
      "Visit pmkisan.gov.in",
      "Click on 'New Farmer Registration'",
      "Enter Aadhaar and land details",
      "Submit and verify",
    ],
    source: "PM-KISAN",
    source_url: "https://pmkisan.gov.in/",
    last_updated: "baseline",
  },
  {
    name: "Kisan Credit Card (KCC)",
    benefit: "Loan up to ₹3 lakh at ~4% interest",
    eligibility: [
      "Farmers with land ownership",
      "Tenant farmers (in some states)",
    ],
    documents: ["Aadhaar", "Land records", "Bank details"],
    apply_steps: [
      "Visit nearest bank",
      "Fill KCC application form",
      "Submit documents",
      "Loan approved within days",
    ],
    source: "KCC",
    source_url: "https://www.myscheme.gov.in/schemes/kcc",
    last_updated: "baseline",
  },
  {
    name: "PMFBY (Crop Insurance)",
    benefit: "Low premium (1.5-2%) and full crop loss coverage",
    eligibility: [
      "Farmers growing notified crops",
      "Loan-taking farmers automatically eligible",
    ],
    documents: ["Aadhaar", "Bank details", "Crop details"],
    apply_steps: [
      "Visit pmfby.gov.in",
      "Select crop and location",
      "Pay premium",
      "Get insurance coverage",
    ],
    source: "PMFBY",
    source_url: "https://pmfby.gov.in/",
    last_updated: "baseline",
  },
  {
    name: "Soil Health Card",
    benefit: "Free soil testing and fertilizer advice",
    eligibility: ["All farmers"],
    documents: ["Land details"],
    apply_steps: [
      "Visit nearest agriculture office",
      "Submit soil sample",
      "Receive report",
    ],
    source: "Soil Health Card",
    source_url: "https://soilhealth.dac.gov.in/",
    last_updated: "baseline",
  },
  {
    name: "NABARD Micro Loan",
    benefit: "₹50,000-₹5 lakh loan",
    eligibility: [
      "Small farmers",
      "Self-help groups",
    ],
    documents: ["Basic ID", "Bank details"],
    apply_steps: [
      "Apply via rural bank",
      "Submit basic documents",
      "Get approval",
    ],
    source: "NABARD",
    source_url: "https://www.nabard.org/",
    last_updated: "baseline",
  },
];

export const DEFAULT_GOVERNMENT_SCHEMES_API_URL =
  "https://api.myscheme.gov.in/search/v1/schemes";
