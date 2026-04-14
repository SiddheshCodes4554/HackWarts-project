import { Schema, model, models } from "mongoose";

export interface OtpDocument {
  email: string;
  otpHash: string;
  expiresAt: Date;
  lastSentAt: Date;
  attempts: number;
  createdAt: Date;
}

const OtpSchema = new Schema<OtpDocument>(
  {
    email: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    lastSentAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    versionKey: false,
  },
);

export const Otp = models.Otp || model<OtpDocument>("Otp", OtpSchema);
