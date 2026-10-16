
"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import Postcard3D from "@/components/Postcard3D";
import { LanguageProvider, LanguageSwitcher, LocalizedTree, useLanguage } from "@/lib/language";

type Postcard = {
  id: string;
  title: string;
  category: string;
  image: string;
};
type PostcardTags = { country: string; city: string; style: string; occasion: string };

type MailCard = {
  id: string;
  title: string;
  image: string;
  frontCaption: string;
  frontCaptionX: number;
  frontCaptionY: number;
  message: string;
  openedAt: string | null;
  createdAt: string;
  contactName: string | null;
  shareUrl: string | null;
};

type Friend = { id: string; personId: string; name: string; createdAt: string };
type FriendsData = { friends: Friend[]; incoming: Friend[]; outgoing: Friend[] };
type ArchivedPostcard = { id: string; title: string; frontImage: string; backImage: string; notes: string; createdAt: string };
type FullscreenPostcardSide = { side: string; image?: string; message?: string; caption?: { text: string; x: number; y: number } };
type AppIconName = "home" | "sent" | "create" | "received" | "profile" | "friends";

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

  if (name === "friends") {
    return <svg className="nav-svg-icon" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c.3-3.3 2.3-5 6-5s5.7 1.7 6 5M17 5a3 3 0 0 1 0 6m2 3c1.4.8 2.2 2.2 2.4 4"/></svg>;
  }

  const glyphs: Record<Exclude<AppIconName, "profile" | "received" | "friends">, string> = {
    home: "⌂",
    sent: "✈",
    create: "+",
  };

  return <span className="app-icon-glyph" aria-hidden="true">{glyphs[name]}</span>;
}

const categories = ["Все", "Мои фото"];

function PostcardFullscreenViewer({ card, onClose }: { card: FullscreenPostcardSide; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function setPan(x: number, y: number, currentZoom = zoomRef.current) {
    const bounds = stageRef.current?.getBoundingClientRect();
    const maxX = bounds ? (bounds.width * (currentZoom - 1)) / 2 : 0;
    const maxY = bounds ? (bounds.height * (currentZoom - 1)) / 2 : 0;
    const next = { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
    offsetRef.current = next;
    setOffset(next);
  }

  function changeZoom(nextZoom: number) {
    const next = Math.max(1, Math.min(5, nextZoom));
    zoomRef.current = next;
    setZoom(next);
    if (next === 1) setPan(0, 0, next);
    else setPan(offsetRef.current.x, offsetRef.current.y, next);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;

    if (pointers.current.size >= 2) {
      const previousPoints = [...pointers.current.entries()].slice(0, 2);
      const nextPoints = previousPoints.map(([pointerId, point]) => pointerId === event.pointerId ? { x: event.clientX, y: event.clientY } : point);
      const beforeDistance = Math.hypot(previousPoints[0][1].x - previousPoints[1][1].x, previousPoints[0][1].y - previousPoints[1][1].y);
      const afterDistance = Math.hypot(nextPoints[0].x - nextPoints[1].x, nextPoints[0].y - nextPoints[1].y);
      if (beforeDistance > 0) changeZoom(zoomRef.current * (afterDistance / beforeDistance));
    } else if (zoomRef.current > 1) {
      setPan(offsetRef.current.x + dx, offsetRef.current.y + dy);
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function endPointer(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="archive-lightbox" role="dialog" aria-modal="true" aria-label={`${card.side} открытки на весь экран`} onClick={onClose}>
      <header className="archive-lightbox-header" onClick={(event) => event.stopPropagation()}>
        <strong>{card.side}</strong>
        <button type="button" className="archive-lightbox-close" aria-label="Закрыть полноэкранный просмотр" onClick={onClose}>×</button>
      </header>
      <div
        ref={stageRef}
        className="archive-lightbox-stage"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={(event) => {
          event.preventDefault();
          changeZoom(zoomRef.current * Math.exp(-event.deltaY * 0.002));
        }}
      >
        <div className="archive-lightbox-artwork" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
          {card.image ? <div className="archive-lightbox-image-wrap"><img src={card.image} alt={card.side} draggable={false} />{card.caption && <span style={{ left: `${card.caption.x}%`, top: `${card.caption.y}%` }}>{card.caption.text}</span>}</div> : <article className="archive-lightbox-message"><span className="postmark">POSTIE</span><p>{card.message}</p><small>С теплом ♡</small></article>}
        </div>
      </div>
      <footer className="archive-lightbox-controls" onClick={(event) => event.stopPropagation()}>
        <span>Щипок или колесо мыши — увеличить · перетаскивание — переместить</span>
        <div>
          <button type="button" aria-label="Уменьшить" onClick={() => changeZoom(zoomRef.current / 1.5)}>−</button>
          <button type="button" aria-label="Сбросить увеличение" onClick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" aria-label="Увеличить" onClick={() => changeZoom(zoomRef.current * 1.5)}>＋</button>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return <LanguageProvider><HomeContent /></LanguageProvider>;
}

function HomeContent() {
  const { language } = useLanguage();
  const [postcards, setPostcards] = useState<Postcard[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState("");
  const [activeView, setActiveView] = useState<"home" | "sent" | "received" | "collections" | "friends" | "archive">("home");
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
  const [frontCaptionX, setFrontCaptionX] = useState(50);
  const [frontCaptionY, setFrontCaptionY] = useState(80);
  const captionDragRef = useRef(false);
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
  const [postcardTags, setPostcardTags] = useState<Record<string, PostcardTags>>({});
  const [canEditTags, setCanEditTags] = useState(false);
  const [tagSavingId, setTagSavingId] = useState<string | null>(null);
  const [tagError, setTagError] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [styleFilter, setStyleFilter] = useState("");
  const [occasionFilter, setOccasionFilter] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "title" | "favorites">("default");
  const [visibleCount, setVisibleCount] = useState(24);
  const [mailboxCards, setMailboxCards] = useState<MailCard[]>([]);
  const [mailboxError, setMailboxError] = useState("");
  const [mailboxLoading, setMailboxLoading] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"friend" | "link">("link");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ message: string; shareUrl: string | null } | null>(null);
  const [friendsData, setFriendsData] = useState<FriendsData>({ friends: [], incoming: [], outgoing: [] });
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendMessage, setFriendMessage] = useState("");
  const [selectedMail, setSelectedMail] = useState<MailCard | null>(null);
  const [mailBackVisible, setMailBackVisible] = useState(false);
  const [digitizeOpen, setDigitizeOpen] = useState(false);
  const [digitizeFront, setDigitizeFront] = useState<File | null>(null);
  const [digitizeBack, setDigitizeBack] = useState<File | null>(null);
  const [digitizeFrontPreview, setDigitizeFrontPreview] = useState("");
  const [digitizeBackPreview, setDigitizeBackPreview] = useState("");
  const [digitizeTitle, setDigitizeTitle] = useState("");
  const [digitizeNotes, setDigitizeNotes] = useState("");
  const [digitizeMessage, setDigitizeMessage] = useState("");
  const [digitizeSaving, setDigitizeSaving] = useState(false);
  const [archiveCards, setArchiveCards] = useState<ArchivedPostcard[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");
  const [selectedArchive, setSelectedArchive] = useState<ArchivedPostcard | null>(null);
  const [fullscreenCard, setFullscreenCard] = useState<FullscreenPostcardSide | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog-tags", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить теги каталога.");
        return result as { tags: Record<string, PostcardTags>; canEdit: boolean };
      })
      .then((result) => { setPostcardTags(result.tags); setCanEditTags(result.canEdit); })
      .catch((error: unknown) => { if (error instanceof Error && error.name !== "AbortError") setTagError(error.message); })
    return () => controller.abort();
  }, []);
  const tagValues = (key: keyof PostcardTags) => [...new Set(Object.values(postcardTags).map((tags) => tags[key].trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
 const filtered = postcards.filter((card) => {
  const matchesCategory =
    category === "Все" || card.category === category;
  const tags = postcardTags[card.id] ?? { country: "", city: "", style: "", occasion: "" };
  const searchable = [card.title, ...Object.values(tags)].join(" ").toLowerCase();
  const matchesSearch = searchable.includes(search.trim().toLowerCase());
  const matchesFavorites =
    !showFavoritesOnly || favorites.includes(card.id);
  return matchesCategory && matchesSearch && matchesFavorites
    && (!countryFilter || tags.country === countryFilter)
    && (!cityFilter || tags.city === cityFilter)
    && (!styleFilter || tags.style === styleFilter)
    && (!occasionFilter || tags.occasion === occasionFilter);
});
  const sortedPostcards = [...filtered].sort((a, b) => {
    if (sortBy === "title") return a.title.localeCompare(b.title, "ru");
    if (sortBy === "favorites") return Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || a.title.localeCompare(b.title, "ru");
    return 0;
  });
  const visiblePostcards = sortedPostcards.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(24);
  }, [category, search, showFavoritesOnly, countryFilter, cityFilter, styleFilter, occasionFilter, sortBy]);

  function updatePostcardTag(cardId: string, key: keyof PostcardTags, value: string) {
    setPostcardTags((current) => {
      const existing = current[cardId] ?? { country: "", city: "", style: "", occasion: "" };
      return { ...current, [cardId]: { ...existing, [key]: value } };
    });
  }

  async function savePostcardTags(cardId: string) {
    setTagSavingId(cardId);
    setTagError("");
    try {
      const response = await fetch("/api/catalog-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcardId: cardId, tags: postcardTags[cardId] ?? { country: "", city: "", style: "", occasion: "" } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить теги.");
      setPostcardTags((current) => ({ ...current, [cardId]: result.tags as PostcardTags }));
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Не удалось сохранить теги.");
    } finally {
      setTagSavingId(null);
    }
  }

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

  useEffect(() => {
    if (activeView !== "archive") return;
    const controller = new AbortController();
    fetch("/api/archive", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Не удалось открыть архив."); return result as ArchivedPostcard[]; })
      .then(setArchiveCards)
      .catch((error: unknown) => { if (error instanceof Error && error.name !== "AbortError") setArchiveError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setArchiveLoading(false); });
    return () => controller.abort();
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "friends" && !(deliveryMode === "friend" && (showCreate || editorOpen))) return;
    const controller = new AbortController();
    setFriendsLoading(true);
    fetch("/api/friends", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Не удалось загрузить друзей."); return data as FriendsData; })
      .then((data) => { setFriendsData(data); if (!recipientId && data.friends[0]) setRecipientId(data.friends[0].personId); })
      .catch((error: unknown) => { if (error instanceof Error && error.name !== "AbortError") setFriendMessage(error.message); })
      .finally(() => { if (!controller.signal.aborted) setFriendsLoading(false); });
    return () => controller.abort();
  }, [activeView, deliveryMode, showCreate, editorOpen]);

  function moveCaption(event: PointerEvent<HTMLParagraphElement>) {
    event.stopPropagation();
    const bounds = event.currentTarget.closest(".front-image-wrap")?.getBoundingClientRect();
    if (!bounds) return;
    setFrontCaptionX(Math.max(5, Math.min(95, ((event.clientX - bounds.left) / bounds.width) * 100)));
    setFrontCaptionY(Math.max(5, Math.min(95, ((event.clientY - bounds.top) / bounds.height) * 100)));
  }

  async function openMailCard(card: MailCard) {
    setSelectedMail(card);
    setMailBackVisible(false);
    if (activeView === "received" && !card.openedAt) {
      const response = await fetch("/api/mailbox/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: card.id }) });
      const result = await response.json();
      if (response.ok) {
        const updated = { ...card, openedAt: result.openedAt as string };
        setSelectedMail(updated);
        setMailboxCards((cards) => cards.map((item) => item.id === card.id ? updated : item));
      }
    }
  }

  async function addFriend(event: FormEvent) {
    event.preventDefault(); setFriendMessage("");
    const response = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: friendEmail }) });
    const result = await response.json();
    setFriendMessage(result.message || result.error || "Готово.");
    if (response.ok) { setFriendEmail(""); const refreshed = await fetch("/api/friends", { cache: "no-store" }).then((r) => r.json()); setFriendsData(refreshed); }
  }

  async function respondFriend(id: string, action: "accept" | "decline") {
    const response = await fetch("/api/friends/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    const result = await response.json();
    if (!response.ok) { setFriendMessage(result.error || "Не удалось обработать запрос."); return; }
    const refreshed = await fetch("/api/friends", { cache: "no-store" }).then((r) => r.json()); setFriendsData(refreshed);
  }

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
          recipientId: deliveryMode === "friend" ? recipientId : null,
          title: frontCaption || selected?.title || "Тёплая открытка",
          imageSource,
          frontCaption,
          message: greeting,
          shareEnabled: deliveryMode === "link",
          frontCaptionX,
          frontCaptionY,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось отправить открытку.");
      setSendResult({
        message: deliveryMode === "friend" ? "Открытка отправлена другу в Postie." : "Ссылка на открытку готова — отправь её в мессенджере.",
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
      alert(language === "en" ? "Please choose an image." : "Пожалуйста, выбери изображение.");
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

  function chooseDigitizedSide(side: "front" | "back", file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setDigitizeMessage("Для архива выбери изображение JPG, PNG или WebP.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setDigitizeMessage("Размер каждой стороны должен быть меньше 12 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (side === "front") { setDigitizeFront(file); setDigitizeFrontPreview(String(reader.result)); }
      else { setDigitizeBack(file); setDigitizeBackPreview(String(reader.result)); }
      setDigitizeMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function saveDigitizedPostcard() {
    if (!digitizeFront || !digitizeBack) { setDigitizeMessage("Добавь фотографии обеих сторон открытки."); return; }
    setDigitizeSaving(true);
    setDigitizeMessage("");
    const uploadedPaths: string[] = [];
    try {
      const supabase = createSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Войди в аккаунт Postie, чтобы сохранить открытку в архив.");
      const id = crypto.randomUUID();
      const frontExt = digitizeFront.type === "image/png" ? "png" : digitizeFront.type === "image/webp" ? "webp" : "jpg";
      const backExt = digitizeBack.type === "image/png" ? "png" : digitizeBack.type === "image/webp" ? "webp" : "jpg";
      const frontPath = `${user.id}/archive/${id}/front.${frontExt}`;
      const backPath = `${user.id}/archive/${id}/back.${backExt}`;
      const frontUpload = await supabase.storage.from("postcard-images").upload(frontPath, digitizeFront, { contentType: digitizeFront.type, upsert: false });
      if (frontUpload.error) throw new Error(frontUpload.error.message);
      uploadedPaths.push(frontPath);
      const backUpload = await supabase.storage.from("postcard-images").upload(backPath, digitizeBack, { contentType: digitizeBack.type, upsert: false });
      if (backUpload.error) throw new Error(backUpload.error.message);
      uploadedPaths.push(backPath);
      const response = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: digitizeTitle, notes: digitizeNotes, frontImagePath: frontPath, backImagePath: backPath }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить открытку.");
      setDigitizeMessage("Открытка сохранена в «Мои открытки».");
      setDigitizeFront(null); setDigitizeBack(null); setDigitizeFrontPreview(""); setDigitizeBackPreview("");
      setDigitizeTitle(""); setDigitizeNotes("");
      setActiveView("archive");
      setDigitizeOpen(false);
    } catch (error) {
      if (uploadedPaths.length) {
        try { const supabase = createSupabaseClient(); await supabase.storage.from("postcard-images").remove(uploadedPaths); } catch { /* keep the original save error */ }
      }
      setDigitizeMessage(error instanceof Error ? error.message : "Не удалось сохранить открытку.");
    } finally { setDigitizeSaving(false); }
  }

  function editProfileName() {
    const nextName = window.prompt(language === "en" ? "What should we call you?" : "Как тебя называть?", profileName);
    if (nextName === null) return;
    const name = nextName.trim();
    if (!name) return;
    setProfileName(name);
    window.localStorage.setItem("postie-profile-name", name);
  }

  return (
    <LocalizedTree><main className="postie">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Postie — главная">
          Post<span className="brand-i">ı<span className="brand-heart">♥</span></span>e

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
        <LanguageSwitcher />
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

        <div className="catalog-filters" aria-label="Фильтры каталога">
          <select aria-label="Страна" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="">Все страны</option>{tagValues("country").map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Город" value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}><option value="">Все города</option>{tagValues("city").map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Стиль открытки" value={styleFilter} onChange={(event) => setStyleFilter(event.target.value)}><option value="">Все стили</option>{tagValues("style").map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Повод" value={occasionFilter} onChange={(event) => setOccasionFilter(event.target.value)}><option value="">Любой повод</option>{tagValues("occasion").map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label="Сортировка" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="default">По умолчанию</option><option value="title">По названию</option><option value="favorites">Сначала избранные</option></select>
        </div>
        {tagError && <p className="catalog-message" role="status">{tagError}</p>}

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
              {canEditTags ? <details className="postcard-tag-editor">
                <summary>＋ Изменить теги</summary>
                <div className="postcard-tag-fields">
                  {([["country", "Страна"], ["city", "Город"], ["style", "Стиль"], ["occasion", "Повод"]] as const).map(([key, label]) => <label key={key}>{label}<input value={postcardTags[card.id]?.[key] ?? ""} onChange={(event) => updatePostcardTag(card.id, key, event.target.value)} placeholder={label} /></label>)}
                  <button type="button" className="save-tags-button" disabled={tagSavingId === card.id} onClick={() => void savePostcardTags(card.id)}>{tagSavingId === card.id ? "Сохраняю…" : "Сохранить"}</button>
                </div>
              </details> : <p className="postcard-tag-list">{Object.values(postcardTags[card.id] ?? {}).filter(Boolean).join(" · ")}</p>}
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
          {mailboxCards.map((card) => <article className="mail-item" key={card.id}><button type="button" className="mail-item-open" onClick={() => void openMailCard(card)}><img src={card.image} alt="" /><div><strong>{card.contactName || "Ссылка-приглашение"}</strong><span>{card.frontCaption || card.title}</span><small>{new Date(card.createdAt).toLocaleDateString(language === "en" ? "en-US" : "ru-RU")}</small><small className="delivery-status">✓　{card.contactName ? (card.openedAt ? "Открыта" : "Нажми, чтобы открыть") : "Нажми, чтобы посмотреть"}</small></div></button>{card.shareUrl && <button type="button" className="mail-share" onClick={async () => { if (navigator.share) await navigator.share({ title: "Открытка Postie", text: "Для тебя есть открытка!", url: card.shareUrl! }); else await navigator.clipboard.writeText(card.shareUrl!); }}>Поделиться</button>}</article>)}
        </section>
      )}

      {activeView === "received" && (
        <section className="mailbox-screen">
          <div className="mailbox-heading"><div><p className="eyebrow">ТЁПЛЫЕ СЛОВА РЯДОМ</p><h1>Полученные</h1></div><button aria-label="Создать открытку" onClick={() => setShowCreate(true)}>＋</button></div>
          {mailboxLoading && <p className="catalog-message">Открываю полученные…</p>}
          {mailboxError && <p className="catalog-message">{mailboxError} <a href="/auth">Войти или создать аккаунт</a></p>}
          {!mailboxLoading && !mailboxError && mailboxCards.length === 0 && <p className="catalog-message">Когда тебе отправят открытку, она появится здесь.</p>}
          {mailboxCards.map((card) => <article className="mail-item" key={card.id}><button type="button" className="mail-item-open" onClick={() => void openMailCard(card)}><img src={card.image} alt="" /><div><strong>{card.contactName || "Друг Postie"}</strong><span>{card.frontCaption || card.title}</span><small>{new Date(card.createdAt).toLocaleDateString(language === "en" ? "en-US" : "ru-RU")}</small><small className="delivery-status">♥　{card.openedAt ? "Ты уже открыл эту открытку" : "Нажми, чтобы открыть"}</small></div></button></article>)}
        </section>
      )}

      {activeView === "friends" && (
        <section className="mailbox-screen friends-screen">
          <div className="mailbox-heading"><div><p className="eyebrow">ВАШ КРУГ</p><h1>Друзья</h1></div></div>
          <form className="friend-add-form" onSubmit={(event) => void addFriend(event)}><label className="greeting-label">Добавить по почте аккаунта<input className="greeting-input" type="email" value={friendEmail} onChange={(event) => setFriendEmail(event.target.value)} placeholder="friend@example.com" required /></label><button className="primary-button full-button" type="submit">Отправить запрос</button></form>
          {friendMessage && <p className="friend-message" role="status">{friendMessage}</p>}
          {friendsLoading && <p className="catalog-message">Загружаю друзей…</p>}
          <h2>Запросы тебе</h2>
          {friendsData.incoming.map((friend) => <div className="friend-row" key={friend.id}><strong>{friend.name}</strong><button type="button" onClick={() => void respondFriend(friend.id, "accept")}>Принять</button><button type="button" onClick={() => void respondFriend(friend.id, "decline")}>Отклонить</button></div>)}
          {!friendsData.incoming.length && <p className="delivery-hint">Новых запросов пока нет.</p>}
          <h2>Мои друзья · {friendsData.friends.length}</h2>
          {friendsData.friends.map((friend) => <div className="friend-row" key={friend.id}><span className="friend-avatar">{friend.name.charAt(0).toUpperCase()}</span><strong>{friend.name}</strong><button type="button" onClick={() => { setRecipientId(friend.personId); setDeliveryMode("friend"); setShowCreate(true); }}>Отправить открытку</button></div>)}
          {!friendsData.friends.length && <p className="delivery-hint">Подтверждённые друзья появятся здесь.</p>}
          {friendsData.outgoing.length > 0 && <><h2>Ожидают подтверждения</h2>{friendsData.outgoing.map((friend) => <div className="friend-row" key={friend.id}><strong>{friend.name}</strong><small>Запрос отправлен</small></div>)}</>}
        </section>
      )}

      {activeView === "archive" && (
        <section className="mailbox-screen archive-screen">
          <div className="mailbox-heading"><div><p className="eyebrow">ТВОЯ СЕМЕЙНАЯ ИСТОРИЯ</p><h1>Мои открытки</h1></div><button type="button" aria-label="Оцифровать открытку" onClick={() => setDigitizeOpen(true)}>＋</button></div>
          {archiveLoading && <p className="catalog-message">Открываю архив…</p>}
          {archiveError && <p className="catalog-message">{archiveError} <a href="/auth">Войти в аккаунт</a></p>}
          {!archiveLoading && !archiveError && archiveCards.length === 0 && <p className="catalog-message">Здесь будут храниться оцифрованные открытки. Добавь фотографии лицевой и обратной стороны.</p>}
          <div className="archive-grid">{archiveCards.map((card) => <button type="button" className="archive-card" key={card.id} onClick={() => setSelectedArchive(card)}><img src={card.frontImage} alt="" /><strong>{card.title}</strong><small>{new Date(card.createdAt).toLocaleDateString(language === "en" ? "en-US" : "ru-RU")}</small></button>)}</div>
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
                <img className="photo-preview" src={photo} alt="Твоя открытка" onClick={() => setFullscreenCard({ image: photo, side: "Лицевая сторона" })} />
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
                  setFrontCaption(""); setFrontCaptionX(50); setFrontCaptionY(80);
                }}>
                  Продолжить →
                </button>
              </>
            ) : selected ? (
              <>
                <p className="eyebrow">ТВОЯ БУДУЩАЯ ОТКРЫТКА</p>
                <h2>{selected.title}</h2>
                <img className="photo-preview" src={selected.image} alt={selected.title} onClick={() => setFullscreenCard({ image: selected.image, side: "Лицевая сторона" })} />
                <p>Выбери этот дизайн для своей личной открытки.</p>
                <button
  className="primary-button full-button"
  onClick={() => {
    setEditorOpen(true);
    setShowBack(false);
    setFrontCaption(""); setFrontCaptionX(50); setFrontCaptionY(80);
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
                <button className="choice-card" onClick={() => { setShowCreate(false); setDigitizeMessage(""); setDigitizeOpen(true); }}>
                  <span className="choice-icon">▤</span>
                  <span><strong>Оцифровать старую открытку</strong><small>Сохрани обе стороны в личном архиве</small></span>
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

      <Postcard3D
        backVisible={showBack}
        className="editor-3d"
        onTap={(side) => setFullscreenCard(side === "front" ? { side: "Лицевая сторона", image: photo || selected?.image || undefined, caption: frontCaption.trim() ? { text: frontCaption, x: frontCaptionX, y: frontCaptionY } : undefined } : { side: "Обратная сторона", message: greeting || "Здесь появится твоё поздравление…" })}
        front={<div className="editor-face-front"><div className="front-image-wrap">{photo ? <img src={photo} alt="Лицевая сторона открытки" /> : selected ? <img src={selected.image} alt={selected.title} /> : null}{frontCaption.trim() && <p className="front-caption-overlay" onPointerDown={(event) => { event.stopPropagation(); captionDragRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); moveCaption(event); }} onPointerMove={(event) => { if (captionDragRef.current && event.buttons === 1) moveCaption(event); }} onPointerUp={(event) => { event.stopPropagation(); captionDragRef.current = false; }} style={{ left: `${frontCaptionX}%`, top: `${frontCaptionY}%`, transform: "translate(-50%, -50%)", fontFamily, fontSize: `${fontSize}px`, color: fontColor, fontWeight: isBold ? 700 : 400, fontStyle: isItalic ? "italic" : "normal", textAlign }}>{frontCaption}</p>}</div></div>}
        back={<div className="editor-face-back"><span className="postmark">POSTIE</span><p>{greeting || "Здесь появится твоё поздравление…"}</p><span className="signature">С теплом ♡</span></div>}
      />

      <label className="greeting-label">
        Подпись на лицевой стороне · необязательно
        <input className="greeting-input" value={frontCaption} onChange={(event) => setFrontCaption(event.target.value)} placeholder="Например, наше лето в Грузии" maxLength={60} />
        <small className="delivery-hint">Перетащи надпись мышью или пальцем в нужное место открытки.</small>
      </label>
      <div className="text-editor-controls" aria-label="Настройки текста">
        <label>Шрифт<select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}><option value="Georgia">Georgia</option><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="'Times New Roman'">Times New Roman</option><option value="'Courier New'">Courier New</option></select></label>
        <label>Размер<span className="font-size-control"><input type="range" min="12" max="64" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /><output>{fontSize} px</output></span></label>
        <label>Цвет<input className="color-control" type="color" value={fontColor} onChange={(event) => setFontColor(event.target.value)} /></label>
        <div className="format-controls" aria-label="Начертание"><button type="button" className={isBold ? "format-button active" : "format-button"} aria-pressed={isBold} onClick={() => setIsBold((value) => !value)}><strong>Ж</strong></button><button type="button" className={isItalic ? "format-button active" : "format-button"} aria-pressed={isItalic} onClick={() => setIsItalic((value) => !value)}><em>К</em></button></div>
        <label>Выравнивание<select value={textAlign} onChange={(event) => setTextAlign(event.target.value as "left" | "center" | "right")}><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label>
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
        <div className="delivery-choice" role="group" aria-label="Способ отправки"><button type="button" className={deliveryMode === "friend" ? "active" : ""} onClick={() => setDeliveryMode("friend")}>Другу Postie</button><button type="button" className={deliveryMode === "link" ? "active" : ""} onClick={() => setDeliveryMode("link")}>Ссылка в мессенджер</button></div>
        {deliveryMode === "friend" ? <label className="greeting-label">Кому отправить?{friendsData.friends.length ? <select className="greeting-input" value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>{friendsData.friends.map((friend) => <option key={friend.personId} value={friend.personId}>{friend.name}</option>)}</select> : <span>Сначала добавь друга и дождись подтверждения. <button type="button" className="mail-share" onClick={() => { setEditorOpen(false); setActiveView("friends"); }}>Открыть друзей</button></span>}</label> : <p className="delivery-hint">Открытку можно будет посмотреть по ссылке без регистрации.</p>}
        <button className="primary-button full-button" onClick={sendPostcard} disabled={sending || (deliveryMode === "friend" && !friendsData.friends.some((friend) => friend.personId === recipientId))}>{sending ? "Отправляю…" : "Отправить открытку"}</button>
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
      alert(language === "en" ? "Choose an image." : "Выберите изображение.");
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
        onClick={() => { setShowProfile(false); setActiveView("friends"); }}
      >
        <span><AppIcon name="friends" /></span> Друзья <span>›</span>
      </button>

      <button type="button" className="profile-link" onClick={() => { setShowProfile(false); setArchiveError(""); setActiveView("archive"); }}>
        <span>▣</span> Мои открытки <span>›</span>
      </button>

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
        onClick={() => alert(language === "en" ? "No drafts yet." : "Черновиков пока нет.")}
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
        onClick={() => alert(language === "en" ? "Postie help" : "Помощь Postie")}
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
{selectedMail && (
  <div className="modal-backdrop" onClick={() => setSelectedMail(null)}>
    <section className="create-modal opened-mail-modal" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="modal-close" aria-label="Закрыть открытку" onClick={() => setSelectedMail(null)}>×</button>
      <p className="eyebrow">{mailBackVisible ? "ТЕКСТ ОТКРЫТКИ" : "ТЕБЕ ПРИШЛА ОТКРЫТКА"}</p>
      <h2>{selectedMail.title}</h2>
      <Postcard3D
        backVisible={mailBackVisible}
        className="opened-card-3d"
        onTap={(side) => setFullscreenCard(side === "front" ? { side: "Лицевая сторона", image: selectedMail.image, caption: selectedMail.frontCaption.trim() ? { text: selectedMail.frontCaption, x: selectedMail.frontCaptionX, y: selectedMail.frontCaptionY } : undefined } : { side: "Обратная сторона", message: selectedMail.message || "Пусть этот момент останется с тобой." })}
        front={<div className="opened-card-image"><img src={selectedMail.image} alt={selectedMail.frontCaption || selectedMail.title} />{selectedMail.frontCaption.trim() && <span style={{ left: `${selectedMail.frontCaptionX}%`, top: `${selectedMail.frontCaptionY}%` }}>{selectedMail.frontCaption}</span>}</div>}
        back={<div className="opened-card-message"><span className="postmark">POSTIE</span><p>{selectedMail.message || "Пусть этот момент останется с тобой."}</p><small>С теплом ♡</small></div>}
      />
      <p className="delivery-hint">{activeView === "sent" ? `Для: ${selectedMail.contactName || "по ссылке"}` : `От: ${selectedMail.contactName || "друга Postie"}`}</p>
      <button type="button" className="primary-button full-button" onClick={() => setMailBackVisible((value) => !value)}>{mailBackVisible ? "Посмотреть лицевую сторону" : "Прочитать поздравление"}</button>
      {selectedMail.shareUrl && <button type="button" className="mail-share" onClick={async () => { if (navigator.share) await navigator.share({ title: "Открытка Postie", text: "Для тебя есть открытка!", url: selectedMail.shareUrl! }); else await navigator.clipboard.writeText(selectedMail.shareUrl!); }}>Поделиться ссылкой</button>}
    </section>
  </div>
)}
{digitizeOpen && (
  <div className="modal-backdrop" onClick={() => setDigitizeOpen(false)}>
    <section className="create-modal digitize-modal" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="modal-close" aria-label="Закрыть" onClick={() => setDigitizeOpen(false)}>×</button>
      <p className="eyebrow">ЛИЧНЫЙ АРХИВ</p><h2>Оцифровать открытку</h2>
      <p className="delivery-hint">Сфотографируй обе стороны. Открытка сохранится только в твоём профиле.</p>
      <div className="digitize-side-grid">
        <label className="digitize-side"><strong>Лицевая сторона</strong>{digitizeFrontPreview ? <img src={digitizeFrontPreview} alt="Лицевая сторона" /> : <span className="digitize-placeholder">＋ Добавить фото</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseDigitizedSide("front", event.target.files?.[0])} /></label>
        <label className="digitize-side"><strong>Обратная сторона</strong>{digitizeBackPreview ? <img src={digitizeBackPreview} alt="Обратная сторона" /> : <span className="digitize-placeholder">＋ Добавить фото</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseDigitizedSide("back", event.target.files?.[0])} /></label>
      </div>
      <label className="greeting-label">Название<input className="greeting-input" value={digitizeTitle} onChange={(event) => setDigitizeTitle(event.target.value)} placeholder="Например, открытка от бабушки" maxLength={100} /></label>
      <label className="greeting-label">Заметка · необязательно<textarea className="greeting-input" value={digitizeNotes} onChange={(event) => setDigitizeNotes(event.target.value)} placeholder="Откуда открытка и когда получена?" rows={3} maxLength={2000} /></label>
      {digitizeMessage && <p className="friend-message" role="status">{digitizeMessage}</p>}
      <button type="button" className="primary-button full-button" disabled={digitizeSaving || !digitizeFront || !digitizeBack} onClick={() => void saveDigitizedPostcard()}>{digitizeSaving ? "Сохраняю…" : "Сохранить в «Мои открытки»"}</button>
    </section>
  </div>
)}
{selectedArchive && (
  <div className="modal-backdrop" onClick={() => setSelectedArchive(null)}>
    <section className="create-modal opened-mail-modal archive-view-modal" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="modal-close" aria-label="Закрыть" onClick={() => setSelectedArchive(null)}>×</button>
      <p className="eyebrow">{language === "en" ? "PERSONAL ARCHIVE · " : "ЛИЧНЫЙ АРХИВ · "}{new Date(selectedArchive.createdAt).toLocaleDateString(language === "en" ? "en-US" : "ru-RU")}</p><h2>{selectedArchive.title}</h2>
      <Postcard3D className="archive-3d" onTap={(side) => setFullscreenCard({ side: side === "front" ? "Лицевая сторона" : "Обратная сторона", image: side === "front" ? selectedArchive.frontImage : selectedArchive.backImage })} front={<div className="archive-face"><img src={selectedArchive.frontImage} alt="Лицевая сторона старой открытки" /></div>} back={<div className="archive-face"><img src={selectedArchive.backImage} alt="Обратная сторона старой открытки" /></div>} />
      {selectedArchive.notes && <p className="archive-notes">{selectedArchive.notes}</p>}
    </section>
  </div>
)}
{fullscreenCard && <PostcardFullscreenViewer card={fullscreenCard} onClose={() => setFullscreenCard(null)} />}
    </main></LocalizedTree>
  );
}





