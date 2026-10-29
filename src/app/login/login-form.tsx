"use client";

// Participants sign in with the code staff hand out; staff use a whitelisted Google account.

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { fieldCls, primaryBtn } from "@/components/festival-ui";
import { signInWithCode, signInWithGoogle } from "./actions";

export function LoginForm({ next, staff, staffError }: { next: string; staff: boolean; staffError: boolean }) {
  const [mode, setMode] = useState<"code" | "staff">(staff || staffError ? "staff" : "code");
  return (
    <div className="mt-6">
      {mode === "code" ? <CodeForm next={next} /> : <StaffForm next={next} error={staffError} />}
      <button
        type="button"
        onClick={() => setMode(mode === "code" ? "staff" : "code")}
        className="mt-6 text-sm text-fg/60 underline underline-offset-4 hover:text-fg"
      >
        {mode === "code" ? "운영진이신가요? Google로 로그인" : "참가자 코드로 로그인"}
      </button>
    </div>
  );
}

function CodeForm({ next }: { next: string }) {
  const id = useId();
  const [{ error }, signIn, pending] = useActionState(signInWithCode, {});
  return (
    <form action={signIn} className="grid gap-3" noValidate>
      <input type="hidden" name="next" value={next.startsWith("/organize") ? "/onfestival" : next} />
      <label htmlFor={`${id}-code`} className="text-xs text-fg/60">
        참가자 코드
        <input
          id={`${id}-code`}
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="AB2C-3DEF-4GHJ"
          aria-invalid={!!error}
          aria-describedby={`${id}-hint`}
          className={`${fieldCls} text-center text-xl uppercase tracking-[0.15em] tabular-nums`}
        />
      </label>
      <p id={`${id}-hint`} className="text-xs text-fg/50">
        현장에서 운영진에게 받은 12자리 코드입니다. 대소문자와 하이픈은 상관없습니다.
      </p>
      {error && (
        <p role="alert" className="text-sm text-[var(--g-red)]">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryBtn} py-2.5 text-base`}>
        {pending ? "확인 중…" : "입장하기"}
      </button>
    </form>
  );
}

// Staff sign in with Google; only whitelisted emails get an account.
function StaffForm({ next, error }: { next: string; error: boolean }) {
  return (
    <form action={signInWithGoogle} className="grid gap-3">
      <input type="hidden" name="next" value={next.startsWith("/organize") ? next : "/organize"} />
      {error && (
        <p role="alert" className="text-sm text-[var(--g-red)]">
          운영진 명단에 없는 Google 계정이거나 로그인이 취소되었습니다. 등록된 계정으로 다시 시도해 주세요.
        </p>
      )}
      <GoogleButton />
      <p className="text-xs text-fg/50">운영진 명단에 등록된 Google 계정만 로그인할 수 있습니다.</p>
    </form>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-3 border border-fg/25 bg-page px-4 py-2.5 text-base font-bold transition hover:bg-fg/10 disabled:opacity-40"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c1-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
      {pending ? "Google로 이동 중…" : "Google 계정으로 로그인"}
    </button>
  );
}
