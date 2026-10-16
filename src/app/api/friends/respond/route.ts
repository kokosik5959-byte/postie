import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { id?: string; action?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Не удалось прочитать запрос." }, { status: 400 }); }
  if (!body.id || !["accept", "decline"].includes(body.action ?? "")) return Response.json({ error: "Выбери запрос и действие." }, { status: 400 });
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Войди в Postie, чтобы подтвердить запрос." }, { status: 401 });
  const query = supabase.from("friendships").update(body.action === "accept" ? { status: "accepted", accepted_at: new Date().toISOString() } : { status: "pending" })
    .eq("id", body.id).eq("addressee_id", user.id).eq("status", "pending");
  const { data, error } = body.action === "decline"
    ? await supabase.from("friendships").delete().eq("id", body.id).eq("addressee_id", user.id).eq("status", "pending").select("id").maybeSingle()
    : await query.select("id").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data) return Response.json({ error: "Запрос уже обработан или не найден." }, { status: 404 });
  return Response.json({ ok: true });
}
