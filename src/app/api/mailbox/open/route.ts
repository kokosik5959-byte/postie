import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { id?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Не удалось открыть открытку." }, { status: 400 }); }
  if (!body.id) return Response.json({ error: "Открытка не найдена." }, { status: 400 });
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Войди в Postie, чтобы открыть открытку." }, { status: 401 });
  const { data: card, error: readError } = await supabase.from("postcards").select("id, recipient_id, opened_at").eq("id", body.id).maybeSingle();
  if (readError || !card || card.recipient_id !== user.id) return Response.json({ error: "Эта открытка недоступна." }, { status: 404 });
  if (!card.opened_at) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("postcards").update({ opened_at: new Date().toISOString() }).eq("id", body.id).eq("recipient_id", user.id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось отметить открытку прочитанной." }, { status: 503 }); }
  }
  return Response.json({ openedAt: card.opened_at || new Date().toISOString() });
}
