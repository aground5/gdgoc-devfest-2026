"use client";

// Participants sign in with the code staff hand out; staff use their whitelisted email.

import { useActionState, useId, useState } from "react";
import { fieldCls, primaryBtn, smallBtn } from "@/components/festival-ui";
import { sendLink, signInWithCode, verifyCode, type LoginState } from "./actions";

export function LoginForm({ next, staff, linkError }: { next: string; staff: boolean; linkError: boolean }) {
  const [mode, setMode] = useState<"code" | "staff">(staff || linkError ? "staff" : "code");
  return (
    <div className="mt-6">
      {mode === "code" ? <CodeForm next={next} /> : <StaffForm next={next} linkError={linkError} />}
      <button
        type="button"
        onClick={() => setMode(mode === "code" ? "staff" : "code")}
        className="mt-6 text-sm text-fg/60 underline underline-offset-4 hover:text-fg"
      >
        {mode === "code" ? "운영진이신가요? 이메일로 로그인" : "참가자 코드로 로그인"}
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

function StaffForm({ next, linkError }: { next: string; linkError: boolean }) {
  const id = useId();
  const staffNext = next.startsWith("/organize") ? next : "/organize";
  const [state, send, sending] = useActionState(sendLink, {
    step: "email",
    email: "",
    next: staffNext,
    error: linkError ? "링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요." : undefined,
  } satisfies LoginState);
  const [{ error }, verify, verifying] = useActionState(verifyCode, {});

  if (state.step === "code") {
    return (
      <form action={verify} className="grid gap-3" noValidate>
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={state.next} />
        <p role="status" className="text-sm leading-relaxed">
          <strong className="font-bold">{state.email}</strong> 이 운영진 명단에 있다면 로그인 메일을 보냈습니다. 메일의 버튼을
          누르거나, 메일에 있는 6자리 코드를 입력하세요.
        </p>
        <label htmlFor={`${id}-otp`} className="text-xs text-fg/60">
          메일로 받은 코드
          <input
            id={`${id}-otp`}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-invalid={!!error}
            className={`${fieldCls} text-center text-2xl tracking-[0.4em] tabular-nums`}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-[var(--g-red)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={verifying} className={`${primaryBtn} flex-1 py-2.5 text-base`}>
            {verifying ? "확인 중…" : "로그인"}
          </button>
          <button type="button" onClick={() => location.reload()} className={smallBtn}>
            다른 이메일
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={send} className="grid gap-3" noValidate>
      <input type="hidden" name="next" value={staffNext} />
      <label htmlFor={`${id}-email`} className="text-xs text-fg/60">
        운영진 이메일
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          aria-invalid={!!state.error}
          className={fieldCls}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-[var(--g-red)]">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={sending} className={`${primaryBtn} py-2.5 text-base`}>
        {sending ? "보내는 중…" : "로그인 메일 받기"}
      </button>
      <p className="text-xs text-fg/50">운영진 명단에 등록된 이메일만 로그인할 수 있습니다.</p>
    </form>
  );
}
