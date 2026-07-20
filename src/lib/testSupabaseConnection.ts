import { supabase } from "./supabase";

export async function testSupabaseConnection(): Promise<void> {
  const {
    data: { session: existingSession },
    error: getSessionError,
  } = await supabase.auth.getSession();

  if (getSessionError) {
    throw getSessionError;
  }

  let session = existingSession;

  if (!session) {
    const { data, error: signInError } =
      await supabase.auth.signInAnonymously();

    if (signInError) {
      throw signInError;
    }

    session = data.session;
  }

  if (!session) {
    throw new Error("익명 로그인 세션을 생성하지 못했습니다.");
  }

  const { error: selectError } = await supabase
    .from("ourhome_menus")
    .select("menu_date")
    .limit(1);

  if (selectError) {
    throw selectError;
  }

  console.log("✅ Supabase DB 연결 성공");
  console.log("익명 사용자 ID:", session.user.id);
}
