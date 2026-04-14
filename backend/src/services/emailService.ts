const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim() ?? "";
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() ?? "";
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "FarmEase";

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  if (!senderEmail) {
    throw new Error("BREVO_SENDER_EMAIL is not configured");
  }

  return { apiKey, senderEmail, senderName };
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const { apiKey, senderEmail, senderName } = getBrevoConfig();

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email }],
      subject: "Your FarmEase OTP Code",
      textContent: `Your OTP is: ${otp}. It will expire in 5 minutes.`,
      htmlContent: `<p>Your OTP is: <strong>${otp}</strong></p><p>It will expire in 5 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Brevo delivery rejected (${response.status}): ${errorPayload}`);
  }
}
