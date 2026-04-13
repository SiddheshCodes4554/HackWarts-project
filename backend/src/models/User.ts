import { Schema, model, models } from "mongoose";

export interface UserLocation {
  lat?: number;
  lon?: number;
  district?: string;
  state?: string;
}

export interface UserDocument {
  email: string;
  role: "farmer" | "buyer";
  name: string;
  location: UserLocation;
  land_area: number;
  primary_crop: string;
  createdAt: Date;
  updatedAt: Date;
  passwordHash?: string;
}

const UserLocationSchema = new Schema<UserLocation>(
  {
    lat: { type: Number },
    lon: { type: Number },
    district: { type: String },
    state: { type: String },
  },
  { _id: false },
);

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, unique: true, required: true, index: true },
    role: { type: String, enum: ["farmer", "buyer"], required: true },
    name: { type: String, default: "" },
    location: { type: UserLocationSchema, default: {} },
    land_area: { type: Number, default: 0 },
    primary_crop: { type: String, default: "" },
    passwordHash: { type: String, select: false },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  {
    versionKey: false,
  },
);

export const User = models.User || model<UserDocument>("User", UserSchema);
