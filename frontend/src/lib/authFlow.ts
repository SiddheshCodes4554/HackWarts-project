import { AuthError, Session, User, setMongoSession, supabase } from './supabaseClient';

type AuthFlowMode = 'login' | 'signup';

type AuthFlowSuccess = {
  ok: true;
  mode: AuthFlowMode;
  user: User;
  session: Session;
};

type AuthFlowFailure = {
  ok: false;
  message: string;
  retryAfterSeconds?: number;
};

export type AuthFlowResult = AuthFlowSuccess | AuthFlowFailure;

type OtpSendResult = {
  ok: boolean;
  message: string;
  retryAfterSeconds?: number;
};

type LoginOrSignupOptions = {
  allowSignup?: boolean;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:5000'
).replace(/\/$/, '');

function normalizeMessage(error: unknown): string {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error.toLowerCase();
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
  }

  return '';
}

function isRateLimitError(error: AuthError | null): boolean {
  if (!error) {
    return false;
  }

  const message = normalizeMessage(error);
  return (
    error.status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('over_email_send_rate_limit')
  );
}

function isInvalidCredentialsError(error: AuthError | null): boolean {
  if (!error) {
    return false;
  }

  const message = normalizeMessage(error);
  return (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    message.includes('invalid email or password')
  );
}

function isDuplicateUserError(error: AuthError | null): boolean {
  if (!error) {
    return false;
  }

  const message = normalizeMessage(error);
  return (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('user already registered') ||
    message.includes('email address is already in use')
  );
}

function parseRetryAfterSeconds(error: AuthError | null): number {
  if (!error) {
    return 60;
  }

  const rawMessage =
    typeof error.message === 'string'
      ? error.message
      : '';
  const match = rawMessage.match(/(\d+)\s*(s|sec|secs|second|seconds|m|min|minute|minutes)/i);
  if (!match) {
    return 60;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return 60;
  }

  const unit = match[2].toLowerCase();
  if (unit.startsWith('m')) {
    return Math.min(600, value * 60);
  }

  return Math.min(600, value);
}

export async function sendEmailOtp(email: string): Promise<OtpSendResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, message: 'Email is required.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.error === 'string' ? payload.error : 'Unable to send OTP right now.';
      const match = message.match(/(\d+)s/i);
      return {
        ok: false,
        message,
        retryAfterSeconds: match ? Number(match[1]) : undefined,
      };
    }

    return {
      ok: true,
      message: 'OTP sent to your email.',
    };
  } catch {
    return {
      ok: false,
      message: 'Unable to send OTP right now. Please try again.',
    };
  }
}

export async function verifyEmailOtp(params: {
  email: string;
  otp: string;
  role: 'farmer' | 'buyer';
  name?: string;
}): Promise<AuthFlowResult> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedOtp = params.otp.trim();

  if (!normalizedEmail || !normalizedOtp) {
    return {
      ok: false,
      message: 'Email and OTP are required.',
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        otp: normalizedOtp,
        role: params.role,
        name: params.name,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.session || !payload?.user) {
      return {
        ok: false,
        message: typeof payload?.error === 'string' ? payload.error : 'Invalid OTP.',
      };
    }

    setMongoSession(payload.session as Session);

    return {
      ok: true,
      mode: 'login',
      user: payload.user as User,
      session: payload.session as Session,
    };
  } catch {
    return {
      ok: false,
      message: 'Unable to verify OTP right now. Please try again.',
    };
  }
}

function friendlyErrorMessage(params: {
  signInError: AuthError | null;
  signUpError: AuthError | null;
}): string {
  const { signInError, signUpError } = params;

  if (isRateLimitError(signInError) || isRateLimitError(signUpError)) {
    return 'Too many attempts, try again later.';
  }

  if (isDuplicateUserError(signUpError)) {
    if (isInvalidCredentialsError(signInError)) {
      return 'Incorrect password.';
    }

    return 'Account exists, please login.';
  }

  if (isInvalidCredentialsError(signInError)) {
    return 'Incorrect password.';
  }

  return 'Unable to authenticate right now. Please try again.';
}

async function ensureProfileExists(userId: string, email: string): Promise<void> {
  try {
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingProfile) {
      return; // Profile already exists
    }

    // Create default profile if missing
    await supabase
      .from('profiles')
      .insert({
        id: userId,
        name: email.split('@')[0],
        location_name: 'Default Location',
        latitude: 0,
        longitude: 0,
        land_area: 0,
        primary_crop: 'General',
        language: 'en',
      });
  } catch (err) {
    // Silently fail - profile creation is not critical for login
    console.error('Error ensuring profile exists:', err);
  }
}

export async function loginOrSignup(
  email: string,
  password: string,
  role?: 'farmer' | 'buyer',
  options: LoginOrSignupOptions = {},
): Promise<AuthFlowResult> {
  const allowSignup = options.allowSignup ?? true;
  const normalizedEmail = email.trim().toLowerCase();

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (!signInError && signInData.user && signInData.session) {
    // Ensure profile exists for users who may have been created via API/SQL
    await ensureProfileExists(signInData.user.id, normalizedEmail);
    
    return {
      ok: true,
      mode: 'login',
      user: signInData.user,
      session: signInData.session,
    };
  }

  if (isRateLimitError(signInError)) {
    return {
      ok: false,
      message: 'Too many attempts, try again later.',
      retryAfterSeconds: parseRetryAfterSeconds(signInError),
    };
  }

  if (!allowSignup) {
    return {
      ok: false,
      message: isInvalidCredentialsError(signInError)
        ? 'Incorrect password.'
        : 'Unable to authenticate right now. Please try again.',
    };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: role ? { role } : undefined,
    },
  });

  if (!signUpError && signUpData.user && signUpData.session) {
    return {
      ok: true,
      mode: 'signup',
      user: signUpData.user,
      session: signUpData.session,
    };
  }

  if (!signUpError && signUpData.user && !signUpData.session) {
    return {
      ok: false,
      message: 'Account created. Please verify your email before logging in.',
    };
  }

  return {
    ok: false,
    message: friendlyErrorMessage({ signInError, signUpError }),
    retryAfterSeconds: isRateLimitError(signUpError)
      ? parseRetryAfterSeconds(signUpError)
      : undefined,
  };
}
