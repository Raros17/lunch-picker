import type { Session } from "@supabase/supabase-js";

import { supabase } from "./supabase";

let sessionPromise: Promise<Session> | null = null;

export function ensureAnonymousSession(): Promise<Session> {
  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = createOrLoadSession().catch(error => {
    sessionPromise = null;
    throw error;
  });

  return sessionPromise;
}

async function createOrLoadSession(): Promise<Session> {
  const {
    data: { session: existingSession },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (existingSession) {
    return existingSession;
  }

  const { data, error: signInError } = await supabase.auth.signInAnonymously();

  if (signInError) {
    throw signInError;
  }

  if (!data.session) {
    throw new Error("익명 사용자 세션을 만들지 못했습니다.");
  }

  return data.session;
}
