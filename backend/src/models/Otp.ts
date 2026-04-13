import { Schema, model, models } from "mongoose";

export interface OtpDocument {
  email: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const OtpSchema = new Schema<OtpDocument>(
  {
    email: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    createdAt: { type: Date, default: () => new Date() },
  },
  {
    versionKey: false,
  },
);

export const Otp = models.Otp || model<OtpDocument>("Otp", OtpSchema);
