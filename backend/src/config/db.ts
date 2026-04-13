import mongoose from "mongoose";

let isConnected = false;

export async function connectDb(): Promise<void> {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  const mongoUri = process.env.MONGO_URI?.trim();
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error);
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("MongoDB disconnected");
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10_000,
  });

  isConnected = true;
  console.log("MongoDB connected successfully");
}
