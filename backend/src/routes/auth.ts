import { randomInt, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { Request, Response, Router } from "express";
import { HydratedDocument } from "mongoose";
import { Otp } from "../models/Otp";
import { User, UserDocument } from "../models/User";

const authRouter = Router();
const OTP_TTL_MS = 10 * 60 * 1000;

function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeRole(role: unknown): "farmer" | "buyer" {
  return role === "buyer" ? "buyer" : "farmer";
}

function hashSecret(secret: string, salt = randomUUID().replace(/-/g, "")): string {
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifySecret(secret: string, stored: string): boolean {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) {
    return false;
  }

  const candidate = scryptSync(secret, salt, 64);
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
    createdAt: now,
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

async function createOtp(email: string): Promise<string> {
  const otp = String(randomInt(100000, 1000000));
  await Otp.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        otp,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  return otp;
}

authRouter.post("/send-otp", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const otp = await createOtp(email);

    return res.status(200).json({
      ok: true,
      message: "OTP generated successfully",
      ...(process.env.NODE_ENV === "production" ? {} : { otp }),
    });
  } catch (error) {
    console.error("send-otp error", error);
    return res.status(500).json({ error: "Unable to send OTP" });
  }
});

authRouter.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    const role = normalizeRole(req.body?.role);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : email.split("@")[0];
    const land_area = Number(req.body?.land_area ?? 0);
    const primary_crop = typeof req.body?.primary_crop === "string" ? req.body.primary_crop.trim() : "General";
    const location = req.body?.location && typeof req.body.location === "object" ? req.body.location : {};

    if (!email || !otp) {
      return res.status(400).json({ error: "email and otp are required" });
    }

    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc || otpDoc.otp !== otp || otpDoc.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ error: "Invalid or expired OTP" });
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
      ok: true,
      user: publicUser(user),
      profile: publicProfile(user),
      session: {
        access_token: randomUUID(),
        user: publicUser(user),
      },
    });
  } catch (error) {
    console.error("verify-otp error", error);
    return res.status(500).json({ error: "Unable to verify OTP" });
  }
});

authRouter.post("/signup", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const role = normalizeRole(req.body?.role ?? req.body?.options?.data?.role);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : email.split("@")[0];
    const land_area = Number(req.body?.land_area ?? 0);
    const primary_crop = typeof req.body?.primary_crop === "string" ? req.body.primary_crop.trim() : "General";
    const location = req.body?.location && typeof req.body.location === "object" ? req.body.location : {};

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const existing = await User.findOne({ email }).select("+passwordHash");
    if (existing && existing.passwordHash) {
      return res.status(409).json({ error: "User already registered" });
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

    user.passwordHash = hashSecret(password);
    await user.save();

    return res.status(200).json({
      ok: true,
      user: publicUser(user),
      profile: publicProfile(user),
      session: {
        access_token: randomUUID(),
        user: publicUser(user),
      },
    });
  } catch (error) {
    console.error("signup error", error);
    return res.status(500).json({ error: "Unable to create account" });
  }
});

authRouter.post("/signin", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !user.passwordHash || !verifySecret(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid login credentials" });
    }

    return res.status(200).json({
      ok: true,
      user: publicUser(user),
      profile: publicProfile(user),
      session: {
        access_token: randomUUID(),
        user: publicUser(user),
      },
    });
  } catch (error) {
    console.error("signin error", error);
    return res.status(500).json({ error: "Unable to sign in" });
  }
});

export { authRouter, publicProfile, publicUser };
