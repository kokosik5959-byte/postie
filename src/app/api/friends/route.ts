import { createClient } from "@/lib/supabase/server";

type FriendshipRow = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted"; created_at: string };
type ProfileRow = { id: string; display_name: string };

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Войди в Postie, чтобы посмотреть друзей." }, { status: 401 });
  const { data, error } = await supabase.from("friendships").select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  const rows = (data ?? []) as FriendshipRow[];
  const ids = [...new Set(rows.map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id))];
  const profiles = ids.length ? await supabase.from("profiles").select("id, display_name").in("id", ids) : { data: [], error: null };
  if (profiles.error) return Response.json({ error: profiles.error.message }, { status: 400 });
  const names = new Map(((profiles.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.display_name]));
  const shape = (row: FriendshipRow) => {
    const personId = row.requester_id === user.id ? row.addressee_id : row.requester_id;
    return { id: row.id, personId, name: names.get(personId) || "Друг Postie", createdAt: row.created_at };
  };
  return Response.json({
    friends: rows.filter((row) => row.status === "accepted").map(shape),
    incoming: rows.filter((row) => row.status === "pending" && row.addressee_id === user.id).map(shape),
    outgoing: rows.filter((row) => row.status === "pending" && row.requester_id === user.id).map(shape),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { email?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Укажи почту аккаунта друга." }, { status: 400 }); }
  const email = body.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Проверь адрес электронной почты." }, { status: 400 });
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Войди в Postie, чтобы добавить друга." }, { status: 401 });
  const { data, error } = await supabase.rpc("request_friend_by_email", { target_email: email });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  const messages: Record<string, string> = { pending: "Запрос отправлен. Друг появится в списке после подтверждения.", incoming_pending: "У тебя уже есть входящий запрос от этого аккаунта — подтверди его ниже.", already_friends: "Этот аккаунт уже в друзьях." };
  return Response.json({ status: data, message: messages[String(data)] ?? "Готово." });
}
