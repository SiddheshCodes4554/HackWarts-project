import { Schema, model, models } from "mongoose";

export type FarmBoundaryPoint = [number, number];

export interface FarmCenter {
  lat: number;
  lon: number;
}

export interface FarmDocument {
  userId: string;
  boundary: FarmBoundaryPoint[];
  area: number;
  center: FarmCenter;
  name?: string;
  insights?: {
    weather: string[];
    soil: string[];
    recommendations: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const FarmBoundarySchema = new Schema<FarmCenter>(
  {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
  },
  { _id: false },
);

const FarmInsightsSchema = new Schema(
  {
    weather: { type: [String], default: [] },
    soil: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
  },
  { _id: false },
);

const FarmSchema = new Schema<FarmDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    boundary: {
      type: [[Number]],
      required: true,
      validate: {
        validator(value: FarmBoundaryPoint[]) {
          return Array.isArray(value) && value.length >= 3;
        },
        message: "Farm boundary must have at least 3 points",
      },
    },
    area: { type: Number, required: true },
    center: { type: FarmBoundarySchema, required: true },
    name: { type: String, default: "My Farm" },
    insights: { type: FarmInsightsSchema, default: () => ({ weather: [], soil: [], recommendations: [] }) },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

export const Farm = models.Farm || model<FarmDocument>("Farm", FarmSchema);
