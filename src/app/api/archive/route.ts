import { createClient } from "@/lib/supabase/server";

type DigitizedPostcardRow = {
  id: string;
  title: string;
  front_image_path: string;
  back_image_path: string;
  notes: string;
  created_at: string;
};

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 });
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Войди в Postie, чтобы открыть свои открытки." }, { status: 401 });

  const { data, error } = await supabase.from("digitized_postcards")
    .select("id, title, front_image_path, back_image_path, notes, created_at")
    .eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  const cards = await Promise.all(((data ?? []) as DigitizedPostcardRow[]).map(async (card) => {
    const [front, back] = await Promise.all([
      supabase.storage.from("postcard-images").createSignedUrl(card.front_image_path, 60 * 60),
      supabase.storage.from("postcard-images").createSignedUrl(card.back_image_path, 60 * 60),
    ]);
    return {
      id: card.id,
      title: card.title,
      frontImage: front.data?.signedUrl ?? "",
      backImage: back.data?.signedUrl ?? "",
      notes: card.notes,
      createdAt: card.created_at,
    };
  }));
  return Response.json(cards, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { title?: string; frontImagePath?: string; backImagePath?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Не удалось прочитать данные открытки." }, { status: 400 });
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 });
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Войди в Postie, чтобы сохранить открытку." }, { status: 401 });

  const frontImagePath = body.frontImagePath?.trim() ?? "";
  const backImagePath = body.backImagePath?.trim() ?? "";
  const ownedPrefix = `${user.id}/archive/`;
  if (!frontImagePath.startsWith(ownedPrefix) || !backImagePath.startsWith(ownedPrefix) || frontImagePath === backImagePath) {
    return Response.json({ error: "Загрузи обе стороны открытки в свой архив." }, { status: 400 });
  }
  const title = body.title?.trim().slice(0, 100) || "Старая открытка";
  const { data, error } = await supabase.from("digitized_postcards").insert({
    owner_id: user.id,
    title,
    front_image_path: frontImagePath,
    back_image_path: backImagePath,
    notes: body.notes?.trim().slice(0, 2000) || "",
  }).select("id").single();

  if (error) {
    await supabase.storage.from("postcard-images").remove([frontImagePath, backImagePath]);
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ id: data.id }, { status: 201 });
}
