import { Schema, model, models } from "mongoose";

export interface AlertDocument {
  userId: string;
  message: string;
  type: "alert" | "recommendation" | "summary";
  createdAt: Date;
  priority?: "high" | "medium" | "low";
}

const AlertSchema = new Schema<AlertDocument>(
  {
    userId: { type: String, required: true, index: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["alert", "recommendation", "summary"], required: true },
    priority: { type: String, enum: ["high", "medium", "low"] },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false },
);

export const Alert = models.Alert || model<AlertDocument>("Alert", AlertSchema);
