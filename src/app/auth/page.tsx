"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  useEffect(() => {
    setConfirmationError(new URLSearchParams(window.location.search).get("error") === "confirmation");
    if (!configured) return;
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => setAccountEmail(data.user?.email ?? null));
    } catch {
      // The setup message below explains missing environment variables.
    }
  }, [configured]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();
      if (mode === "sign-up") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Почти готово! Перейди по ссылке подтверждения в письме, чтобы активировать аккаунт.");
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось выполнить вход.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setAccountEmail(null);
      setMessage("Ты вышел из аккаунта.");
      router.refresh();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Не удалось выйти из аккаунта.");
    }
  }

  return (
    <main className="postie auth-screen">
      <Link className="auth-back" href="/">← К открыткам</Link>
      <div className="auth-card">
        <p className="brand auth-brand">Post<span className="brand-i">i<span className="brand-heart">♥</span></span>e</p>
        {accountEmail ? (
          <>
            <h1>Ты уже с нами</h1>
            <p className="auth-copy">Вход выполнен для {accountEmail}</p>
            <button className="primary-button full-button" onClick={() => router.push("/")}>Продолжить</button>
            <button className="auth-secondary" onClick={signOut}>Выйти из аккаунта</button>
          </>
        ) : (
          <>
            <p className="eyebrow">ТВОИ ВОСПОМИНАНИЯ — ТЕПЕРЬ С ТОБОЙ</p>
            <h1>{mode === "sign-up" ? "Создать аккаунт" : "С возвращением"}</h1>
            <p className="auth-copy">Сохраняй открытки и отправляй их близким.</p>
            {!configured ? (
              <div className="auth-not-configured">
                Supabase пока не подключён. Скопируй .env.example в .env.local, добавь данные проекта Supabase и перезапусти приложение.
              </div>
            ) : (
              <form className="auth-form" onSubmit={submit}>
                {mode === "sign-up" && <label>Как тебя называть?<input autoComplete="name" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя" /></label>}
                <label>Электронная почта<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
                <label>Пароль<input type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 8 символов" /></label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                {message && <p className="auth-message" role="status">{message}</p>}
                {confirmationError && <p className="auth-error" role="alert">Ссылка подтверждения устарела или уже использована. Попробуй войти или зарегистрироваться снова.</p>}
                <button className="primary-button full-button" disabled={busy}>{busy ? "Секунду…" : mode === "sign-up" ? "Создать аккаунт" : "Войти"}</button>
              </form>
            )}
            <button className="auth-secondary" onClick={() => { setMode(mode === "sign-up" ? "sign-in" : "sign-up"); setError(""); setMessage(""); }}>
              {mode === "sign-up" ? "Уже есть аккаунт? Войти" : "Впервые в Postie? Создать аккаунт"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
