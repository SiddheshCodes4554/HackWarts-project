const GROQ_KEY_ENV_VARS = [
  "GROQ_API_KEY",
  "GROQ_API_KEY_2",
  "GROQ_API_KEY_SECONDARY",
  "GROQ_FINANCE_API_KEY",
  "NEXT_PUBLIC_GROQ_API_KEY",
  "NEXT_PUBLIC_GROQ_API_KEY_2",
  "NEXT_PUBLIC_GROQ_API_KEY_SECONDARY",
  "NEXT_PUBLIC_GROQ_FINANCE_API_KEY",
];

let nextGroqKeyIndex = 0;

export function getGroqApiKeys(): string[] {
  const keys = GROQ_KEY_ENV_VARS.map((name) => process.env[name]?.trim() ?? "").filter(Boolean);
  return [...new Set(keys)];
}

export function pickGroqApiKey(): string | undefined {
  const keys = getGroqApiKeys();
  if (!keys.length) {
    return undefined;
  }

  const key = keys[nextGroqKeyIndex % keys.length];
  nextGroqKeyIndex = (nextGroqKeyIndex + 1) % keys.length;
  return key;
}