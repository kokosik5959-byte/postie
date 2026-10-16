import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

type SharedPostcardPageProps = { params: Promise<{ token: string }> };

export default async function SharedPostcardPage({ params }: SharedPostcardPageProps) {
  const { token } = await params;
  let card: { id: string; title: string; image_path: string; front_caption: string; front_caption_x: number; front_caption_y: number; message: string; sender_id: string } | null = null;
  let senderName = "Твой близкий человек";
  let imageUrl = "";

  try {
    const admin = createAdminClient();
    const { data } = await admin.from("postcards")
      .select("id, title, image_path, front_caption, front_caption_x, front_caption_y, message, sender_id")
      .eq("share_token", token)
      .eq("share_enabled", true)
      .maybeSingle();
    card = data;

    if (card) {
      await admin.from("postcards").update({ opened_at: new Date().toISOString() }).eq("id", card.id).is("opened_at", null);
      const { data: sender } = await admin.from("profiles").select("display_name").eq("id", card.sender_id).maybeSingle();
      senderName = sender?.display_name || senderName;
      if (card.image_path.startsWith("/postcards/")) {
        imageUrl = card.image_path;
      } else {
        const { data: signedImage } = await admin.storage.from("postcard-images").createSignedUrl(card.image_path, 60 * 60);
        imageUrl = signedImage?.signedUrl || "";
      }
    }
  } catch {
    // Missing project configuration is explained on the page below.
  }

  return (
    <main className="postie shared-screen">
      <div className="phone-status" aria-hidden="true"><span>9:41</span><span>●●●　◖　▰</span></div>
      <Link className="auth-back" href="/">← Postie</Link>
      {card && imageUrl ? (
        <article className="shared-postcard">
          <p className="eyebrow">ТЕБЕ ПРИШЛА ОТКРЫТКА</p>
          <h1>{card.title}</h1>
          <div className="shared-image-wrap"><img src={imageUrl} alt={card.front_caption || card.title} />{card.front_caption.trim() && <span className="shared-front-caption" style={{ left: `${card.front_caption_x}%`, top: `${card.front_caption_y}%` }}>{card.front_caption}</span>}</div>
          <p className="shared-sender">От {senderName}</p>
          {card.message && <p className="shared-message">{card.message}</p>}
          <Link href="/auth" className="primary-button full-button">Создать свою открытку</Link>
        </article>
      ) : (
        <div className="shared-empty">
          <span aria-hidden="true">✉</span>
          <h1>Открытка пока не найдена</h1>
          <p>Возможно, ссылка устарела или владелец отключил общий доступ.</p>
          <Link href="/" className="primary-button full-button">Посмотреть открытки</Link>
        </div>
      )}
    </main>
  );
}
