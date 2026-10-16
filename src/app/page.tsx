
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type Postcard = {
  id: string;
  title: string;
  category: string;
  image: string;
};

type MailCard = {
  id: string;
  title: string;
  image: string;
  frontCaption: string;
  message: string;
  openedAt: string | null;
  createdAt: string;
  contactName: string | null;
  shareUrl: string | null;
};

type AppIconName = "home" | "sent" | "create" | "received" | "profile";

function AppIcon({ name }: { name: AppIconName }) {
  if (name === "received") {
    return (
      <svg className="nav-svg-icon" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 10a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v5H4z" />
        <path d="M7 11h10M12 15v6m-4 0h8M18 7V3l3 1v4" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg className="nav-svg-icon" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21c.4-4.1 2.8-6.3 7-6.3s6.6 2.2 7 6.3" />
      </svg>
    );
  }

  const glyphs: Record<Exclude<AppIconName, "profile" | "received">, string> = {
    home: "⌂",
    sent: "✈",
    create: "+",
  };

  return <span className="app-icon-glyph" aria-hidden="true">{glyphs[name]}</span>;
}

const categories = ["Все", "Мои фото"];

export default function Home() {
  const [postcards, setPostcards] = useState<Postcard[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState("");
  const [activeView, setActiveView] = useState<"home" | "sent" | "received" | "collections">("home");
  const [category, setCategory] = useState("Все");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [profileName, setProfileName] = useState("Николай");
  useEffect(() => {
  const savedName = window.localStorage.getItem("postie-profile-name");
  if (savedName) setProfileName(savedName);
  const savedAvatar = window.localStorage.getItem("postie-profile-avatar");
  if (savedAvatar) setProfileAvatar(savedAvatar);
  const savedScale = window.localStorage.getItem("postie-avatar-scale");
  const savedX = window.localStorage.getItem("postie-avatar-x");
  const savedY = window.localStorage.getItem("postie-avatar-y");

  if (savedScale) setAvatarScale(Number(savedScale));
  if (savedX) setAvatarX(Number(savedX));
  if (savedY) setAvatarY(Number(savedY));
  }, []);
  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseClient>;
    try {
      supabase = createSupabaseClient();
    } catch {
      setAuthLoaded(true);
      return;
    }

    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setAccountEmail(data.user?.email ?? null);
        setAuthLoaded(true);
      }
    }).catch(() => {
      if (active) setAuthLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountEmail(session?.user.email ?? null);
      setAuthLoaded(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/postcards", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не получилось загрузить каталог фотографий.");
        return (await response.json()) as Postcard[];
      })
      .then(setPostcards)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setPhotosError(error instanceof Error ? error.message : "Не получилось загрузить фотографии.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPhotosLoading(false);
      });

    return () => controller.abort();
  }, []);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const profileAvatarInput = useRef<HTMLInputElement>(null);
  const [avatarScale, setAvatarScale] = useState(1);
  const [avatarX, setAvatarX] = useState(50);
  const [avatarY, setAvatarY] = useState(50);
  const [avatarEditing, setAvatarEditing] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<Postcard | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");
  const [frontCaption, setFrontCaption] = useState("");
  const [fontFamily, setFontFamily] = useState("Georgia");
  const [fontSize, setFontSize] = useState(28);
  const [fontColor, setFontColor] = useState("#ffffff");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(true);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [editorOpen, setEditorOpen] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);
  const [mailboxCards, setMailboxCards] = useState<MailCard[]>([]);
  const [mailboxError, setMailboxError] = useState("");
  const [mailboxLoading, setMailboxLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [shareEnabled, setShareEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ message: string; shareUrl: string | null } | null>(null);
 const filtered = postcards.filter((card) => {
  const matchesCategory =
    category === "Все" || card.category === category;
  const matchesSearch = card.title
    .toLowerCase()
    .includes(search.trim().toLowerCase());
  const matchesFavorites =
    !showFavoritesOnly || favorites.includes(card.id);

  return matchesCategory && matchesSearch && matchesFavorites;
});
  const visiblePostcards = filtered.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(24);
  }, [category, search, showFavoritesOnly]);

  useEffect(() => {
    if (activeView !== "sent" && activeView !== "received") return;
    const controller = new AbortController();
    setMailboxLoading(true);
    setMailboxError("");
    fetch(`/api/mailbox?box=${activeView}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось открыть почту.");
        return result as MailCard[];
      })
      .then(setMailboxCards)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") setMailboxError(error.message);
      })
      .finally(() => { if (!controller.signal.aborted) setMailboxLoading(false); });
    return () => controller.abort();
  }, [activeView]);

  async function sendPostcard() {
    const imageSource = photo || selected?.image;
    if (!imageSource) return;
    setSending(true);
    setSendResult(null);
    try {
      const response = await fetch("/api/postcards/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail,
          title: frontCaption || selected?.title || "Тёплая открытка",
          imageSource,
          frontCaption,
          message: greeting,
          shareEnabled,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось отправить открытку.");
      setSendResult({
        message: result.deliveredToUser
          ? "Открытка отправлена в почту Postie получателя."
          : "Открытка сохранена. Если получатель ещё не в Postie, отправь ему ссылку-приглашение.",
        shareUrl: result.shareUrl,
      });
    } catch (error) {
      setSendResult({
        message: error instanceof Error ? error.message : "Не удалось отправить открытку.",
        shareUrl: null,
      });
    } finally {
      setSending(false);
    }
  }
  
  function choosePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Пожалуйста, выбери изображение.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setSelected(null);
      setShowCreate(false);
    };
    reader.readAsDataURL(file);
  }

  function editProfileName() {
    const nextName = window.prompt("Как тебя называть?", profileName);
    if (nextName === null) return;
    const name = nextName.trim();
    if (!name) return;
    setProfileName(name);
    window.localStorage.setItem("postie-profile-name", name);
  }

  return (
    <main className="postie">
      <div className="phone-status" aria-hidden="true"><span>9:41</span><span>●●●　◖　▰</span></div>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Postie — главная">
          Postie<span className="brand-heart">♥</span>

<svg
  className="brand-lines"
  viewBox="0 0 42 18"
  aria-hidden="true"
>
  <path d="M2 3 C6 1, 9 5, 13 3 S20 1, 24 3 S31 5, 40 3" />
  <path d="M2 9 C6 7, 9 11, 13 9 S20 7, 24 9 S31 11, 40 9" />
  <path d="M2 15 C6 13, 9 17, 13 15 S20 13, 24 15 S31 17, 40 15" />
</svg>

        </a>
        <button
          className="icon-button"
          aria-label="Поиск"
          onClick={() => document.getElementById("catalog-search")?.focus()}
        >
          ⌕
        </button>
      </header>

      <section className="intro">
        <p className="eyebrow">МАЛЕНЬКИЙ ЖЕСТ. БОЛЬШОЕ ЧУВСТВО.</p>
        <h1>Отправь кому-то<br />что-то особенное.</h1>
        <p className="intro-text">
          Не просто фото. Открытка, которую хочется сохранить.
        </p>
        <button className="primary-button" onClick={() => setShowCreate(true)}>
          <span>＋</span> Создать открытку
        </button>
      </section>

      <section className="featured">
        <div className="featured-copy">
          <span className="featured-label">КОЛЛЕКЦИЯ МОМЕНТОВ</span>
          <h2>Привет из<br />Грузии</h2>
          <p>Море, горы и воспоминания.</p>
          <button
            className="light-button"
            onClick={() => {
              setCategory("Путешествия");
              document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Смотреть коллекцию ↗
          </button>
        </div>
       <div
  className="featured-image"
  role="img"
  aria-label="Старый Батуми на закате"
/>
        <span className="stamp">POSTIE<br />№ 001</span>
      </section>

      <section className="catalog-section" id="catalog" hidden={activeView !== "home" && activeView !== "collections"}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">НАЙДИ СВОЮ</p>
            <h2>{activeView === "collections" ? "Мои коллекции" : showFavoritesOnly ? "Избранное" : "Открытки"}</h2>
          </div>
          <span className="count">{filtered.length} фото</span>
        </div>

        <input
          id="catalog-search"
          className="search-input"
          placeholder="⌕  Найти открытку..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="category-list">
          {categories.map((item) => (
            <button
              key={item}
              className={`category-chip ${category === item ? "active" : ""}`}
              onClick={() => { setShowFavoritesOnly(false); setCategory(item);
}}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="postcard-grid">
          {visiblePostcards.map((card) => (
            <article
              className="postcard"
              data-title={card.title.toLowerCase()}
              key={card.id}
            >
              <button
                className="postcard-image-button"
                onClick={() => setSelected(card)}
                aria-label={`Выбрать открытку ${card.title}`}
              >
                <img src={card.image} alt={card.title} loading="lazy" decoding="async" />
                <span className="paper-mark">POSTIE ✉</span>
              </button>
              <div className="postcard-info">
                <button
                  className="card-title"
                  onClick={() => setSelected(card)}
                >
                  {card.title}
                </button>
                <button
                  className={`favorite ${favorites.includes(card.id) ? "is-favorite" : ""}`}
                  aria-label="В избранное"
                  onClick={() =>
                    setFavorites((old) =>
                      old.includes(card.id)
                        ? old.filter((id) => id !== card.id)
                        : [...old, card.id]
                    )
                  }
                >
                  {favorites.includes(card.id) ? "♥" : "♡"}
                </button>
              </div>
              <p className="card-category">{card.category}</p>
            </article>
          ))}
        </div>
        {photosLoading && <p className="catalog-message">Загружаю твои фотографии…</p>}
        {!photosLoading && photosError && <p className="catalog-message">{photosError}</p>}
        {!photosLoading && !photosError && filtered.length === 0 && (
          <p className="catalog-message">В папке пока нет фотографий. Добавь JPG, PNG, WebP, AVIF или GIF в public/postcards.</p>
        )}
        {visibleCount < filtered.length && (
          <button className="load-more-button" onClick={() => setVisibleCount((count) => count + 24)}>
            Показать ещё ({filtered.length - visibleCount})
          </button>
        )}
      </section>

      {activeView === "sent" && (
        <section className="mailbox-screen">
          <div className="mailbox-heading"><div><p className="eyebrow">ТВОИ ИСТОРИИ</p><h1>Отправленные</h1></div><button aria-label="Создать открытку" onClick={() => setShowCreate(true)}>＋</button></div>
          {mailboxLoading && <p className="catalog-message">Открываю отправленные…</p>}
          {mailboxError && <p className="catalog-message">{mailboxError} <a href="/auth">Войти или создать аккаунт</a></p>}
          {!mailboxLoading && !mailboxError && mailboxCards.length === 0 && <p className="catalog-message">Здесь появятся открытки, которые ты отправишь.</p>}
          {mailboxCards.map((card) => <article className="mail-item" key={card.id}><img src={card.image} alt="" /><div><strong>{card.contactName || "Ссылка-приглашение"}</strong><span>{card.frontCaption || card.title}</span><small>{new Date(card.createdAt).toLocaleDateString("ru-RU")}</small><small className="delivery-status">✓　{card.contactName ? (card.openedAt ? "Открыта" : "Доставлена") : "Можно поделиться ссылкой"}</small>{card.shareUrl && <button type="button" className="mail-share" onClick={async () => { if (navigator.share) await navigator.share({ title: "Открытка Postie", text: "Для тебя есть открытка!", url: card.shareUrl! }); else await navigator.clipboard.writeText(card.shareUrl!); }}>Поделиться ссылкой</button>}</div></article>)}
        </section>
      )}

      {activeView === "received" && (
        <section className="mailbox-screen">
          <div className="mailbox-heading"><div><p className="eyebrow">ТЁПЛЫЕ СЛОВА РЯДОМ</p><h1>Полученные</h1></div><button aria-label="Создать открытку" onClick={() => setShowCreate(true)}>＋</button></div>
          {mailboxLoading && <p className="catalog-message">Открываю полученные…</p>}
          {mailboxError && <p className="catalog-message">{mailboxError} <a href="/auth">Войти или создать аккаунт</a></p>}
          {!mailboxLoading && !mailboxError && mailboxCards.length === 0 && <p className="catalog-message">Когда тебе отправят открытку, она появится здесь.</p>}
          {mailboxCards.map((card) => <article className="mail-item" key={card.id}><img src={card.image} alt="" /><div><strong>{card.contactName || "Друг Postie"}</strong><span>{card.frontCaption || card.title}</span><small>{new Date(card.createdAt).toLocaleDateString("ru-RU")}</small><small className="delivery-status">♥　{card.openedAt ? "Ты уже открыл эту открытку" : "Для тебя"}</small></div></article>)}
        </section>
      )}

      <footer className="bottom-nav">
        <button className={`nav-item ${activeView === "home" || activeView === "collections" ? "selected" : ""}`} onClick={() => { setActiveView("home"); setShowFavoritesOnly(false); }}>
          <span><AppIcon name="home" /></span>Главная
        </button>
        <button className={`nav-item ${activeView === "sent" ? "selected" : ""}`} onClick={() => setActiveView("sent")}>
          <span><AppIcon name="sent" /></span>Отправлено
        </button>
        <button className="nav-item create-nav-item" onClick={() => setShowCreate(true)}>
          <span><AppIcon name="create" /></span>Создать
        </button>
        <button className={`nav-item ${activeView === "received" ? "selected" : ""}`} onClick={() => setActiveView("received")}>
          <span><AppIcon name="received" /></span>Получено
        </button>
        <button className="nav-item" onClick={() => setShowProfile(true)}>
          <span><AppIcon name="profile" /></span>Профиль
        </button>
      </footer>

      {(showCreate || (selected && !editorOpen) || (photo && !editorOpen)) && (
        <div className="modal-backdrop" onClick={() => {
          setShowCreate(false);
          setSelected(null);
          setPhoto(null);
        }}>
          <section className="create-modal" onClick={(event) => event.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => {
                setShowCreate(false);
                setSelected(null);
                setPhoto(null);
              }}
            >
              ✕
            </button>

            {photo ? (
              <>
                <h2>Твоя фотография</h2>
                <img className="photo-preview" src={photo} alt="Твоя открытка" />
                <label className="greeting-label">
  Текст поздравления
  <textarea
    className="caption-input"
    value={greeting}
    onChange={(event) => setGreeting(event.target.value)}
    placeholder="Напиши что-нибудь тёплое..."
    rows={4}
  />
</label>
                <button className="primary-button full-button" onClick={() => {
                  setEditorOpen(true);
                  setShowBack(false);
                }}>
                  Продолжить →
                </button>
              </>
            ) : selected ? (
              <>
                <p className="eyebrow">ТВОЯ БУДУЩАЯ ОТКРЫТКА</p>
                <h2>{selected.title}</h2>
                <img className="photo-preview" src={selected.image} alt={selected.title} />
                <p>Выбери этот дизайн для своей личной открытки.</p>
                <button
  className="primary-button full-button"
  onClick={() => {
    setEditorOpen(true);
    setShowBack(false);
  }}
>
  Выбрать дизайн →
</button>
              </>
            ) : (
              <>
                <p className="eyebrow">С ЧЕГО НАЧНЁМ?</p>
                <h2>Создай свою Postie</h2>
                <p>Выбери готовый дизайн или преврати собственное фото в открытку.</p>
                <button className="choice-card" onClick={() => {
                  setShowCreate(false);
                  setActiveView("home");
                  document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
                }}>
                  <span className="choice-icon">✉</span>
                  <span><strong>Выбрать готовую открытку</strong><small>Авторские дизайны и красивые места</small></span>
                  <span>→</span>
                </button>
                <button className="choice-card" onClick={() => fileInput.current?.click()}>
                  <span className="choice-icon">▧</span>
                  <span><strong>Добавить своё фото</strong><small>Создай открытку из личного момента</small></span>
                  <span>→</span>
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => choosePhoto(event.target.files?.[0])}
                />
              </>
            )}
          </section>
        </div>
      )}
    {editorOpen && (
  <div className="modal-backdrop">
    <section
      className="create-modal postcard-editor"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="modal-close"
        onClick={() => setEditorOpen(false)}
      >
        ×
      </button>

      <p className="eyebrow">ТВОЯ ЛИЧНАЯ ОТКРЫТКА</p>
      <h2>Почти готово!</h2>

      <div className={`editor-postcard ${showBack ? "is-back" : ""}`}>
        {!showBack ? (
          <div className="editor-front">
            
{photo ? (
  <div className="front-image-wrap">
    <img src={photo} alt="Лицевая сторона открытки" />
    <p className="front-caption-overlay" style={{ fontFamily, fontSize: `${fontSize}px`, color: fontColor, fontWeight: isBold ? 700 : 400, fontStyle: isItalic ? "italic" : "normal", textAlign }}>
      {frontCaption || "Моё воспоминание"}
    </p>
  </div>
) : selected ? (
  <div className="front-image-wrap">
    <img src={selected.image} alt={selected.title} />
    <p className="front-caption-overlay" style={{ fontFamily, fontSize: `${fontSize}px`, color: fontColor, fontWeight: isBold ? 700 : 400, fontStyle: isItalic ? "italic" : "normal", textAlign }}>
      {frontCaption || selected.title}
    </p>
  </div>
) : null}

            <label className="greeting-label">
  Подпись на лицевой стороне
  <input
    className="greeting-input"
    value={frontCaption}
    onChange={(event) => setFrontCaption(event.target.value)}
    placeholder="Например, наше лето в Грузии"
    maxLength={60}
  />
</label>
<div className="text-editor-controls" aria-label="Настройки текста">
  <label>Шрифт<select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}><option value="Georgia">Georgia</option><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="'Times New Roman'">Times New Roman</option><option value="'Courier New'">Courier New</option></select></label>
  <label>Размер<span className="font-size-control"><input type="range" min="12" max="64" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /><output>{fontSize} px</output></span></label>
  <label>Цвет<input className="color-control" type="color" value={fontColor} onChange={(event) => setFontColor(event.target.value)} /></label>
  <div className="format-controls" aria-label="Начертание"><button type="button" className={isBold ? "format-button active" : "format-button"} aria-pressed={isBold} onClick={() => setIsBold((value) => !value)}><strong>Ж</strong></button><button type="button" className={isItalic ? "format-button active" : "format-button"} aria-pressed={isItalic} onClick={() => setIsItalic((value) => !value)}><em>К</em></button></div>
  <label>Выравнивание<select value={textAlign} onChange={(event) => setTextAlign(event.target.value as "left" | "center" | "right")}><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label>
</div>
          </div>
        ) : (
          <div className="editor-back">
            <span className="postmark">POSTIE</span>
            <p>{greeting || "Здесь появится твоё поздравление…"}</p>
            <span className="signature">С теплом ♡</span>
          </div>
        )}
      </div>

      <button
        className="primary-button full-button"
        onClick={() => setShowBack((current) => !current)}
      >
        {showBack ? "← Лицевая сторона" : "Перевернуть открытку →"}
      </button>

      {showBack && (
        <label className="greeting-label">
          Текст поздравления
          <textarea
            className="greeting-input"
            value={greeting}
            onChange={(event) => setGreeting(event.target.value)}
            placeholder="Напиши что-нибудь тёплое..."
            rows={4}
          />
        </label>
      )}

      <div className="send-postcard-controls">
        <label className="greeting-label">Почта получателя<input className="greeting-input" type="email" autoComplete="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="friend@example.com" /></label>
        <label className="share-toggle"><input type="checkbox" checked={shareEnabled} onChange={(event) => setShareEnabled(event.target.checked)} /><span><strong>Ссылка для мессенджера</strong><small>Открытка откроется без регистрации</small></span></label>
        <button className="primary-button full-button" onClick={sendPostcard} disabled={sending}>{sending ? "Отправляю…" : "Отправить открытку"}</button>
        {sendResult && <div className="send-result" role="status"><p>{sendResult.message}</p>{sendResult.message.startsWith("Войди в Postie") && <a href="/auth">Войти или создать аккаунт</a>}{sendResult.shareUrl && <><a href={sendResult.shareUrl}>{sendResult.shareUrl}</a><button type="button" onClick={async () => { await navigator.clipboard.writeText(sendResult.shareUrl!); setSendResult((old) => old ? { ...old, message: `${old.message} Ссылка скопирована.` } : old); }}>Скопировать ссылку</button><button type="button" onClick={async () => { if (navigator.share) await navigator.share({ title: "Открытка Postie", text: "Для тебя есть открытка!", url: sendResult.shareUrl! }); else { await navigator.clipboard.writeText(sendResult.shareUrl!); setSendResult((old) => old ? { ...old, message: `${old.message} Ссылка скопирована.` } : old); } }}>Отправить в мессенджер</button></>}</div>}
      </div>

      <button
        className="choice-card editor-close"
        onClick={() => {
          setEditorOpen(false);
          setShowBack(false);
        }}
      >
        Вернуться к каталогу
      </button>
    </section>
  </div>
)}{showProfile && (
  <section className="profile-screen">
    <button
      type="button"
      className="profile-back"
      aria-label="Изменить имя профиля"
      title="Настройки профиля"
      onClick={editProfileName}
    >
      ⚙
    </button>

   <button
  type="button"
  className="profile-avatar"
  onClick={() => profileAvatar ? setAvatarEditing(true) : profileAvatarInput.current?.click()}
  aria-label="Загрузить фото профиля"
>
  {profileAvatar ? (
    <img
  src={profileAvatar}
  alt={`Аватар ${profileName}`}
  style={{
  objectPosition: "50% 50%",
  transform: `translate(${(50 - avatarX) * 0.7}%, ${(50 - avatarY) * 0.7}%) scale(${avatarScale})`,
  transformOrigin: "center",
}}
/>
  ) : (
    profileName.trim().charAt(0).toUpperCase() || "P"
  )}
</button>

<input
  ref={profileAvatarInput}
  type="file"
  accept="image/*"
  hidden
  onChange={(event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Выберите изображение.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
    const avatar = String(reader.result);
    setProfileAvatar(avatar);
    window.localStorage.setItem("postie-profile-avatar", avatar);
   };
    setAvatarEditing(true);
    reader.readAsDataURL(file);
    event.target.value = "";
  }}
/>

{profileAvatar && avatarEditing && (
  <div className="avatar-adjust">
    <button type="button" onClick={() => profileAvatarInput.current?.click()}>Выбрать другое фото</button>
    <label>
      Масштаб
      <input
        type="range"
        min="1"
        max="2.5"
        step="0.05"
        value={avatarScale}
        onChange={(event) => {
  const value = Number(event.target.value);
  setAvatarScale(value);
  window.localStorage.setItem("postie-avatar-scale", String(value));
  }}
      />
    </label>

    <label>
      По горизонтали
      <input
        type="range"
        min="0"
        max="100"
        value={avatarX}
        onChange={(event) => {
  const value = Number(event.target.value);
  setAvatarX(value);
  window.localStorage.setItem("postie-avatar-x", String(value));
  }}
      />
    </label>

    <label>
      По вертикали
      <input
        type="range"
        min="0"
        max="100"
        value={avatarY}
        onChange={(event) => {
  const value = Number(event.target.value);
  setAvatarY(value);
  window.localStorage.setItem("postie-avatar-y", String(value));
  }}
      />
    </label>

    <button
      type="button"
      onClick={() => {
        setAvatarScale(1);
        setAvatarX(50);
        setAvatarY(50);
        window.localStorage.setItem("postie-avatar-scale", "1");
        window.localStorage.setItem("postie-avatar-x", "50");
        window.localStorage.setItem("postie-avatar-y", "50");
      }}
    >
      Сбросить кадрирование
    </button>

    <button
  type="button"
  onClick={() => setAvatarEditing(false)}
>
  Готово
</button>
  </div>
)}
    <h1>{profileName || "Мой профиль"}</h1>
    <p className="profile-subtitle">Моя коллекция воспоминаний</p>
    {authLoaded && (accountEmail ? (
      <div className="profile-account-status">
        <strong><span aria-hidden="true">✓</span> Аккаунт Postie подключён</strong>
        <small>{accountEmail}</small>
        <button type="button" onClick={async () => {
          try {
            const supabase = createSupabaseClient();
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            setAccountEmail(null);
          } catch (error) {
            alert(error instanceof Error ? error.message : "Не удалось выйти из аккаунта.");
          }
        }}>Выйти из аккаунта</button>
      </div>
    ) : (
      <a className="account-link" href="/auth">Войти или создать аккаунт Postie</a>
    ))}

    <div className="profile-stats">
      <div><strong>24</strong><span>Отправлено</span></div>
      <div><strong>18</strong><span>Получено</span></div>
      <div><strong>6</strong><span>Коллекций</span></div>
    </div>

    <div className="profile-menu">
      <button
        type="button"
        className="profile-link"
        onClick={() => {
          setShowProfile(false);
          setShowFavoritesOnly(false);
          setActiveView("collections");
          setCategory("Все");
          setSearch("");
          document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <span>▤</span> Мои коллекции <span>›</span>
      </button>

      <button
        type="button"
        className="profile-link"
        onClick={() => {
          setShowProfile(false);
          setShowFavoritesOnly(true);
          setActiveView("home");
          setCategory("Все");
          setSearch("");
          document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <span>♡</span> Избранное <span>›</span>
      </button>

      <button
        type="button"
        className="profile-link"
        onClick={() => alert("Черновиков пока нет.")}
      >
        <span>▧</span> Черновики <span>›</span>
      </button>

      <button
        type="button"
        className="profile-link"
        onClick={editProfileName}
      >
        <span>⚙</span> Настройки <span>›</span>
      </button>

      <button
        type="button"
        className="profile-link"
        onClick={() => alert("Помощь Postie")}
      >
        <span>?</span> Помощь <span>›</span>
      </button>
    </div>

    <nav className="profile-bottom-nav" aria-label="Основная навигация">
      <button type="button" onClick={() => { setShowProfile(false); setActiveView("home"); }}><span><AppIcon name="home" /></span>Главная</button>
      <button type="button" onClick={() => { setShowProfile(false); setActiveView("sent"); }}><span><AppIcon name="sent" /></span>Отправленные</button>
      <button type="button" onClick={() => { setShowProfile(false); setActiveView("received"); }}><span><AppIcon name="received" /></span>Полученные</button>
      <button type="button" className="active"><span><AppIcon name="profile" /></span>Профиль</button>
    </nav>
  </section>
)}
    </main>
  );
}





