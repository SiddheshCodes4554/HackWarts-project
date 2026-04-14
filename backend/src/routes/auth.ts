import { randomInt, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { Request, Response, Router } from "express";
import { HydratedDocument } from "mongoose";
import { Otp } from "../models/Otp";
import { User, UserDocument } from "../models/User";
import { sendOtpEmail } from "../services/emailService";

const authRouter = Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeRole(role: unknown): "farmer" | "buyer" {
  return role === "buyer" ? "buyer" : "farmer";
}

function generateOTP(): string {
  return String(randomInt(100000, 1000000));
}

function hashOtp(otp: string, salt = randomUUID().replace(/-/g, "")): string {
  const hash = scryptSync(otp, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyOtp(otp: string, stored: string): boolean {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) {
    return false;
  }

  const candidate = scryptSync(otp, salt, 64);
  const expected = Buffer.from(hashed, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function publicUser(user: HydratedDocument<UserDocument>) {
  return {
    id: user.email,
    email: user.email,
    user_metadata: {
      role: user.role,
      name: user.name,
    },
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

function publicProfile(user: HydratedDocument<UserDocument>) {
  return {
    id: user.email,
    email: user.email,
    role: user.role,
    name: user.name,
    location_name: [user.location.district, user.location.state].filter(Boolean).join(", "),
    latitude: user.location.lat ?? 0,
    longitude: user.location.lon ?? 0,
    land_area: user.land_area,
    primary_crop: user.primary_crop,
    language: "English",
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

async function upsertProfile(email: string, payload: Partial<UserDocument>): Promise<HydratedDocument<UserDocument>> {
  const now = new Date();
  const update = {
    email,
    role: normalizeRole(payload.role),
    name: payload.name?.trim() || email.split("@")[0],
    location: payload.location ?? {},
    land_area: typeof payload.land_area === "number" ? payload.land_area : 0,
    primary_crop: payload.primary_crop?.trim() || "General",
    updatedAt: now,
  };

  const doc = await User.findOneAndUpdate(
    { email },
    { $setOnInsert: { createdAt: now }, $set: update },
    { upsert: true, new: true },
  ) as HydratedDocument<UserDocument> | null;

  if (!doc) {
    throw new Error("Unable to persist profile");
  }

  return doc;
}

authRouter.post("/auth/send-otp", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: "email is required" });
    }

    const existing = await Otp.findOne({ email });
    if (existing?.lastSentAt && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      const retryInSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime())) / 1000);
      return res.status(429).json({ success: false, error: `Please wait ${retryInSeconds}s before requesting a new OTP.` });
    }

    const otp = generateOTP();
    const otpHash = hashOtp(otp);
    const now = new Date();

    await sendOtpEmail(email, otp);

    await Otp.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          otpHash,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
          lastSentAt: now,
          createdAt: now,
          attempts: 0,
        },
      },
      { upsert: true, new: true },
    );

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("send-otp error", error);
    const detailedMessage = error instanceof Error ? error.message : "Unable to send OTP right now";
    return res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === "production" ? "Unable to send OTP right now" : detailedMessage,
    });
  }
});

authRouter.post("/auth/verify-otp", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    const role = normalizeRole(req.body?.role);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : email.split("@")[0];
    const land_area = Number(req.body?.land_area ?? 0);
    const primary_crop = typeof req.body?.primary_crop === "string" ? req.body.primary_crop.trim() : "General";
    const location = req.body?.location && typeof req.body.location === "object" ? req.body.location : {};

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: "email and otp are required" });
    }

    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc) {
      return res.status(401).json({ success: false, error: "OTP not found. Please request a new OTP." });
    }

    if (otpDoc.expiresAt.getTime() < Date.now()) {
      await Otp.deleteMany({ email });
      return res.status(401).json({ success: false, error: "OTP expired. Please request a new OTP." });
    }

    if (!verifyOtp(otp, otpDoc.otpHash)) {
      await Otp.updateOne({ email }, { $set: { attempts: (otpDoc.attempts ?? 0) + 1 } });
      return res.status(401).json({ success: false, error: "Invalid OTP" });
    }

    const user = await upsertProfile(email, {
      role,
      name,
      land_area: Number.isFinite(land_area) ? land_area : 0,
      primary_crop,
      location: {
        lat: typeof (location as { lat?: unknown }).lat === "number" ? (location as { lat: number }).lat : undefined,
        lon: typeof (location as { lon?: unknown }).lon === "number" ? (location as { lon: number }).lon : undefined,
        district: typeof (location as { district?: unknown }).district === "string" ? (location as { district: string }).district : undefined,
        state: typeof (location as { state?: unknown }).state === "string" ? (location as { state: string }).state : undefined,
      },
    });

    await Otp.deleteMany({ email });

    return res.status(200).json({
      success: true,
      user: publicUser(user),
      profile: publicProfile(user),
      session: {
        access_token: randomUUID(),
        user: publicUser(user),
      },
    });
  } catch (error) {
    console.error("verify-otp error", error);
    return res.status(500).json({ success: false, error: "Unable to verify OTP" });
  }
});

export { authRouter, publicProfile, publicUser };
