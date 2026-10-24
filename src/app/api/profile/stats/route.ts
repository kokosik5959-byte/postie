import { createClient } from "@/lib/supabase/server";

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Войди в Postie, чтобы посмотреть статистику." }, { status: 401 });

  const [sent, received] = await Promise.all([
    supabase.from("postcards").select("id", { count: "exact", head: true }).eq("sender_id", user.id),
    supabase.from("postcards").select("id", { count: "exact", head: true }).eq("recipient_id", user.id),
  ]);

  if (sent.error || received.error) {
    return Response.json({ error: sent.error?.message ?? received.error?.message ?? "Не удалось загрузить статистику." }, { status: 400 });
  }

  return Response.json({ sent: sent.count ?? 0, received: received.count ?? 0 }, {
    headers: { "Cache-Control": "no-store" },
  });
}
