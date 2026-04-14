import { Resend } from "resend";

function getResendClient(): Resend {
  const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return new Resend(resendApiKey);
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const resend = getResendClient();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";

  const response = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Your FarmEase OTP Code",
    text: `Your OTP is: ${otp}. It will expire in 5 minutes.`,
    html: `<p>Your OTP is: <strong>${otp}</strong></p><p>It will expire in 5 minutes.</p>`,
  });

  if (response.error) {
    const details = typeof response.error.message === "string" ? response.error.message : "unknown provider error";
    throw new Error(`Resend delivery rejected: ${details}`);
  }
}
