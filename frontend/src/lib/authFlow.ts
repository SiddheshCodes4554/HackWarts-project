import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

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

type LoginOrSignupOptions = {
  allowSignup?: boolean;
};

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
