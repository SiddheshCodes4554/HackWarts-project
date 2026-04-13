import { randomUUID } from "crypto";
import { Router, Request, Response } from "express";
import { connectDb } from "../config/db";
import mongoose from "mongoose";

const mongoRouter = Router();

type FilterClause = {
  field: string;
  operator: "eq" | "neq" | "in" | "lte" | "gte" | "ilike";
  value: unknown;
};

type QueryPayload = {
  collection: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  filters?: FilterClause[];
  data?: unknown;
  sort?: { field: string; ascending?: boolean };
  range?: { from: number; to: number };
  limit?: number;
  single?: boolean;
  count?: boolean;
};

function resolveCollectionName(collection: string): string {
  if (collection === "profiles") {
    return "users";
  }

  return collection;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toMongoFilter(filters: FilterClause[] | undefined): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  for (const clause of filters ?? []) {
    const field = clause.field;
    const value = clause.value;

    switch (clause.operator) {
      case "eq":
        query[field] = value;
        break;
      case "neq":
        query[field] = { $ne: value };
        break;
      case "in":
        query[field] = { $in: Array.isArray(value) ? value : [value] };
        break;
      case "lte":
        query[field] = { $lte: value };
        break;
      case "gte":
        query[field] = { $gte: value };
        break;
      case "ilike": {
        const raw = String(value ?? "").trim();
        const pattern = escapeRegex(raw).replaceAll("%", ".*");
        query[field] = new RegExp(pattern, "i");
        break;
      }
      default:
        break;
    }
  }

  return query;
}

function normalizeDocument(document: Record<string, unknown>): Record<string, unknown> {
  const next = { ...document };
  if (!next.id && next._id) {
    next.id = String(next._id);
  }
  delete next._id;
  return next;
}

mongoRouter.post("/query", async (req: Request, res: Response) => {
  try {
    await connectDb();

    const payload = req.body as QueryPayload;
    const collectionName = resolveCollectionName(payload.collection);
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MongoDB connection is not ready");
    }

    const collection = db.collection(collectionName);
    const query = toMongoFilter(payload.filters);

    if (payload.action === "insert") {
      const docs = Array.isArray(payload.data) ? payload.data : [payload.data];
      const normalized = docs
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          ...item,
          id: typeof item.id === "string" && item.id ? item.id : randomUUID(),
          created_at: typeof item.created_at === "string" ? item.created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

      if (!normalized.length) {
        return res.status(400).json({ error: "data is required for insert" });
      }

      const inserted = await collection.insertMany(normalized);
      const records = Object.values(inserted.insertedIds).length
        ? await collection.find({ id: { $in: normalized.map((item) => item.id as string) } }).toArray()
        : [];

      return res.status(200).json({ data: records.map(normalizeDocument), error: null, count: records.length });
    }

    if (payload.action === "upsert") {
      const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : null;
      if (!data) {
        return res.status(400).json({ error: "data is required for upsert" });
      }

      const docId = typeof data.id === "string" && data.id ? data.id : randomUUID();
      const next = {
        ...data,
        id: docId,
        created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await collection.updateOne(
        query,
        { $set: next },
        { upsert: true },
      );

      const record = await collection.findOne({ id: docId }) ?? next;
      return res.status(200).json({ data: normalizeDocument(record as Record<string, unknown>), error: null, count: 1 });
    }

    if (payload.action === "update") {
      const update = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : null;
      if (!update) {
        return res.status(400).json({ error: "data is required for update" });
      }

      await collection.updateMany(query, { $set: { ...update, updated_at: new Date().toISOString() } });
      const records = await collection.find(query).toArray();
      return res.status(200).json({ data: records.map(normalizeDocument), error: null, count: records.length });
    }

    if (payload.action === "delete") {
      const result = await collection.deleteMany(query);
      return res.status(200).json({ data: [], error: null, count: result.deletedCount });
    }

    const cursor = collection.find(query);

    if (payload.sort?.field) {
      cursor.sort({ [payload.sort.field]: payload.sort.ascending === false ? -1 : 1 });
    }

    if (typeof payload.range?.from === "number" && typeof payload.range?.to === "number") {
      cursor.skip(Math.max(0, payload.range.from));
      cursor.limit(Math.max(0, payload.range.to - payload.range.from + 1));
    }

    if (typeof payload.limit === "number") {
      cursor.limit(Math.max(0, payload.limit));
    }

    const records = await cursor.toArray();
    const normalized = records.map(normalizeDocument);
    const responseData = payload.single ? (normalized[0] ?? null) : normalized;

    return res.status(200).json({
      data: responseData,
      error: null,
      count: payload.count ? records.length : undefined,
    });
  } catch (error) {
    console.error("mongo query error", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Mongo query failed" });
  }
});

export { mongoRouter };
