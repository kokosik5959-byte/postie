import { Buffer } from "node:buffer";
import { createClient } from "@/lib/supabase/server";

type SendRequest = {
  recipientEmail?: string;
  title?: string;
  imageSource?: string;
  frontCaption?: string;
  message?: string;
  shareEnabled?: boolean;
};

const allowedImages: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function POST(request: Request) {
  let body: SendRequest;
  try {
    body = (await request.json()) as SendRequest;
  } catch {
    return Response.json({ error: "Не удалось прочитать открытку." }, { status: 400 });
  }

  const recipientEmail = body.recipientEmail?.trim().toLowerCase() || null;
  const shareEnabled = body.shareEnabled === true;
  const imageSource = body.imageSource ?? "";
  if (!recipientEmail && !shareEnabled) {
    return Response.json({ error: "Укажи почту получателя или включи ссылку-приглашение." }, { status: 400 });
  }
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return Response.json({ error: "Проверь адрес электронной почты получателя." }, { status: 400 });
  }
  if (!imageSource.startsWith("/postcards/") && !imageSource.startsWith("data:image/")) {
    return Response.json({ error: "Выбери изображение для открытки." }, { status: 400 });
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 });
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Войди в Postie, чтобы отправить открытку." }, { status: 401 });
  }

  let imagePath = imageSource;
  if (imageSource.startsWith("data:image/")) {
    const match = imageSource.match(/^data:image\/(jpeg|jpg|png|webp);base64,([\s\S]+)$/i);
    if (!match) return Response.json({ error: "Поддерживаются фото JPG, PNG и WebP." }, { status: 400 });
    const [, extensionValue, base64] = match;
    const contentType = allowedImages[extensionValue.toLowerCase()];
    const image = Buffer.from(base64, "base64");
    if (image.byteLength === 0 || image.byteLength > 12 * 1024 * 1024) {
      return Response.json({ error: "Размер фото должен быть меньше 12 МБ." }, { status: 413 });
    }

    const extension = extensionValue.toLowerCase() === "jpg" ? "jpeg" : extensionValue.toLowerCase();
    imagePath = `${user.id}/${crypto.randomUUID()}/front.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("postcard-images")
      .upload(imagePath, image, { contentType, upsert: false });
    if (uploadError) return Response.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: postcard, error: insertError } = await supabase
    .from("postcards")
    .insert({
      sender_id: user.id,
      recipient_email: recipientEmail,
      title: body.title?.trim().slice(0, 100) || "Тёплая открытка",
      image_path: imagePath,
      front_caption: body.frontCaption?.trim().slice(0, 100) || "",
      message: body.message?.trim().slice(0, 2000) || "",
      share_enabled: shareEnabled,
    })
    .select("id, recipient_id, share_token, share_enabled")
    .single();

  if (insertError) {
    if (imagePath !== imageSource) await supabase.storage.from("postcard-images").remove([imagePath]);
    return Response.json({ error: insertError.message }, { status: 400 });
  }

  if (recipientEmail && !postcard.recipient_id && !shareEnabled) {
    await supabase.from("postcards").delete().eq("id", postcard.id);
    if (imagePath !== imageSource) await supabase.storage.from("postcard-images").remove([imagePath]);
    return Response.json({ error: "Аккаунт с такой почтой не найден. Включи ссылку-приглашение, чтобы отправить открытку без регистрации." }, { status: 422 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return Response.json({
    id: postcard.id,
    deliveredToUser: Boolean(postcard.recipient_id),
    shareUrl: postcard.share_token ? `${appUrl}/p/${postcard.share_token}` : null,
  }, { status: 201 });
}
