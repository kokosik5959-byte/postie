import { readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";

const tagEditorEmail = "kokosik5959@gmail.com";
const tagFields = ["country", "city", "style", "occasion"] as const;
type Tags = Record<(typeof tagFields)[number], string>;

function asTags(input: unknown): Tags {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return Object.fromEntries(tagFields.map((field) => [field, typeof value[field] === "string" ? value[field].trim().slice(0, 80) : ""])) as Tags;
}

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 }); }

  const [{ data: { user } }, result] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("catalog_postcard_tags").select("postcard_id, country, city, style, occasion"),
  ]);
  if (result.error) return Response.json({ error: result.error.message }, { status: 503 });

  const tags = Object.fromEntries((result.data ?? []).map((row) => [row.postcard_id, asTags(row)]));
  return Response.json({ tags, canEdit: user?.email?.toLowerCase() === tagEditorEmail }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try { supabase = await createClient(); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 }); }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== tagEditorEmail) return Response.json({ error: "Редактировать теги может только владелец каталога." }, { status: 403 });

  let body: { postcardId?: string; tags?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Не удалось прочитать теги." }, { status: 400 }); }
  const postcardId = body.postcardId?.trim() ?? "";
  if (!postcardId || postcardId !== path.basename(postcardId)) return Response.json({ error: "Некорректная открытка." }, { status: 400 });

  const files = await readdir(path.join(process.cwd(), "public", "postcards"));
  if (!files.includes(postcardId)) return Response.json({ error: "Открытка не найдена в каталоге." }, { status: 404 });

  const values = asTags(body.tags);
  const { error } = await supabase.from("catalog_postcard_tags").upsert({ postcard_id: postcardId, ...values, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ postcardId, tags: values });
}
