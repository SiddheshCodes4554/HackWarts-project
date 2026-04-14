type Role = 'farmer' | 'buyer';

export type MongoUser = {
  id: string;
  email: string;
  user_metadata?: {
    role?: Role;
    name?: string;
  };
  created_at?: string;
  updated_at?: string;
};

export type Session = {
  access_token: string;
  user: MongoUser;
};

export type User = MongoUser;

export type AuthError = {
  message: string;
  status?: number;
  code?: string;
};

type QueryFilter = {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'lte' | 'gte' | 'ilike';
  value: unknown;
};

type QueryRequest = {
  collection: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  filters?: QueryFilter[];
  data?: unknown;
  sort?: { field: string; ascending?: boolean };
  range?: { from: number; to: number };
  limit?: number;
  single?: boolean;
  count?: boolean;
};

type QueryResponse<T = unknown> = {
  data: T;
  error: AuthError | null;
  count?: number;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'http://localhost:5000'
).replace(/\/$/, '');

const SESSION_KEY = 'farmease.mongo.session';
const AUTH_EVENT = 'farmease-auth-change';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readSession(): Session | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }

  window.dispatchEvent(new Event(AUTH_EVENT));
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `Request failed with HTTP ${response.status}`;
    const error: AuthError = { message, status: response.status };
    throw error;
  }

  return payload as T;
}

function toQueryResponse<T>(data: T, error: AuthError | null = null, count?: number): QueryResponse<T> {
  return { data, error, count };
}

class QueryBuilder {
  private readonly collection: string;
  private action: QueryRequest['action'] = 'select';
  private filters: QueryFilter[] = [];
  private payload: unknown = null;
  private sortConfig: QueryRequest['sort'] = undefined;
  private rangeConfig: QueryRequest['range'] = undefined;
  private limitCount: number | undefined;
  private singleMode = false;
  private countMode = false;
  private returningMode = false;

  constructor(collection: string) {
    this.collection = collection;
  }

  select(_columns = '*', options?: { count?: 'exact' }) {
    if (this.action === 'select') {
      this.action = 'select';
    } else {
      this.returningMode = true;
    }
    this.countMode = options?.count === 'exact';
    return this;
  }

  insert(values: unknown) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }

  update(values: unknown) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  upsert(values: unknown) {
    this.action = 'upsert';
    this.payload = values;
    this.filters = [
      ...this.filters,
      ...deriveUpsertFilters(this.collection, values),
    ];
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'eq', value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'neq', value });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.filters.push({ field, operator: 'in', value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ field, operator: 'lte', value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ field, operator: 'gte', value });
    return this;
  }

  ilike(field: string, value: string) {
    this.filters.push({ field, operator: 'ilike', value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.sortConfig = { field, ascending: options?.ascending };
    return this;
  }

  range(from: number, to: number) {
    this.rangeConfig = { from, to };
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  async execute(): Promise<QueryResponse> {
    const payload: QueryRequest = {
      collection: this.collection,
      action: this.action,
      filters: this.filters,
      data: this.payload,
      sort: this.sortConfig,
      range: this.rangeConfig,
      limit: this.limitCount,
      single: this.singleMode,
      count: this.countMode,
      // Returning mode is kept for compatibility with insert().select().single()
    };

    const response = await requestJson<QueryResponse>(`/mongo/query`, payload);

    if (this.singleMode) {
      if (Array.isArray(response.data)) {
        return toQueryResponse(response.data[0] ?? null, response.error, response.count);
      }
    }

    return response;
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function deriveUpsertFilters(collection: string, values: unknown): QueryFilter[] {
  if (!values || typeof values !== 'object') {
    return [];
  }

  const record = values as Record<string, unknown>;
  const filters: QueryFilter[] = [];

  if (typeof record.id === 'string' && record.id) {
    filters.push({ field: 'id', operator: 'eq', value: record.id });
  }

  if (collection === 'post_reactions') {
    if (typeof record.post_id === 'string' && record.post_id) {
      filters.push({ field: 'post_id', operator: 'eq', value: record.post_id });
    }
    if (typeof record.user_id === 'string' && record.user_id) {
      filters.push({ field: 'user_id', operator: 'eq', value: record.user_id });
    }
  }

  if (collection === 'bids') {
    if (typeof record.listing_id === 'string' && record.listing_id) {
      filters.push({ field: 'listing_id', operator: 'eq', value: record.listing_id });
    }
    if (typeof record.buyer_id === 'string' && record.buyer_id) {
      filters.push({ field: 'buyer_id', operator: 'eq', value: record.buyer_id });
    }
  }

  if (collection === 'profiles' || collection === 'users') {
    if (typeof record.email === 'string' && record.email) {
      filters.push({ field: 'email', operator: 'eq', value: record.email });
    }
  }

  return filters;
}

type AuthResult = {
  data: { user: User | null; session: Session | null };
  error: AuthError | null;
};

type BackendAuthPayload = {
  ok?: boolean;
  user?: User;
  session?: Session;
  error?: string;
};

function emitAuthChange(session: Session | null) {
  writeSession(session);
}

export function setMongoSession(session: Session | null): void {
  emitAuthChange(session);
}

export function isSupabaseConfigured(): boolean {
  return true;
}

export function getSupabaseClient() {
  return supabase;
}

export const supabase = {
  auth: {
    async getSession(): Promise<{ data: { session: Session | null } }> {
      return { data: { session: readSession() } };
    },
    onAuthStateChange(callback: (_event: string, session: Session | null) => void) {
      const handler = () => callback('SIGNED_IN', readSession());
      if (typeof window !== 'undefined') {
        window.addEventListener(AUTH_EVENT, handler);
      }

      return {
        data: {
          subscription: {
            unsubscribe() {
              if (typeof window !== 'undefined') {
                window.removeEventListener(AUTH_EVENT, handler);
              }
            },
          },
        },
      };
    },
    async signInWithPassword(params: { email: string; password: string }): Promise<AuthResult> {
      try {
        const response = await requestJson<BackendAuthPayload>(`/auth/signin`, {
          email: normalizeEmail(params.email),
          password: params.password,
        });
        const session = response.session ?? null;
        if (session) {
          emitAuthChange(session);
        }
        return { data: { user: response.user ?? null, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: error as AuthError };
      }
    },
    async signUp(params: { email: string; password: string; options?: { data?: Record<string, unknown> } }): Promise<AuthResult> {
      try {
        const response = await requestJson<BackendAuthPayload>(`/auth/signup`, {
          email: normalizeEmail(params.email),
          password: params.password,
          ...params.options?.data,
        });
        const session = response.session ?? null;
        if (session) {
          emitAuthChange(session);
        }
        return { data: { user: response.user ?? null, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: error as AuthError };
      }
    },
    async signOut(_options?: { scope?: string }): Promise<{ error: AuthError | null }> {
      emitAuthChange(null);
      return { error: null };
    },
  },
  from(collection: string) {
    return new QueryBuilder(collection);
  },
  async removeChannel(_channel: unknown) {
    return null;
  },
  channel(_name: string) {
    const channel = {
      on(_event: string, _filter: unknown, _callback: (payload: { new: unknown }) => void) {
        return channel;
      },
      subscribe() {
        return channel;
      },
    };

    return channel;
  },
};

export type Database = unknown;



