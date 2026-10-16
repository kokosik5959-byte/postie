import { createClient } from "@/lib/supabase/server";

type PostcardRow = {
  id: string;
  title: string;
  image_path: string;
  front_caption: string;
  message: string;
  opened_at: string | null;
  created_at: string;
  share_token: string | null;
  share_enabled: boolean;
  sender?: { display_name: string } | null;
  recipient?: { display_name: string } | null;
};

export async function GET(request: Request) {
  const box = new URL(request.url).searchParams.get("box");
  if (box !== "sent" && box !== "received") {
    return Response.json({ error: "Выбери папку открыток." }, { status: 400 });
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Supabase ещё не настроен." }, { status: 503 });
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Войди в Postie, чтобы открыть почту." }, { status: 401 });
  }

  const selection = box === "sent"
    ? "id, title, image_path, front_caption, message, opened_at, created_at, share_token, share_enabled, recipient:profiles!postcards_recipient_id_fkey(display_name)"
    : "id, title, image_path, front_caption, message, opened_at, created_at, share_token, share_enabled, sender:profiles!postcards_sender_id_fkey(display_name)";
  const filter = box === "sent" ? "sender_id" : "recipient_id";
  const { data, error } = await supabase.from("postcards").select(selection).eq(filter, user.id).order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 400 });

  const cards = await Promise.all(((data ?? []) as unknown as PostcardRow[]).map(async (card) => {
    let image = card.image_path;
    if (!image.startsWith("/postcards/")) {
      const { data: signedImage, error: imageError } = await supabase.storage.from("postcard-images").createSignedUrl(image, 60 * 60);
      if (!imageError && signedImage) image = signedImage.signedUrl;
    }
    return {
      id: card.id,
      title: card.title,
      image,
      frontCaption: card.front_caption,
      message: card.message,
      openedAt: card.opened_at,
      createdAt: card.created_at,
      contactName: box === "sent" ? card.recipient?.display_name ?? null : card.sender?.display_name ?? "Друг Postie",
      shareUrl: box === "sent" && card.share_enabled && card.share_token
        ? `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/p/${card.share_token}`
        : null,
    };
  }));

  return Response.json(cards, { headers: { "Cache-Control": "no-store" } });
}
