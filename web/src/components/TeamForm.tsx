"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveRegistration } from "@/actions/team";

interface TeamFormProps {
  requested: number;
  contactEmail: string;
  registered: boolean;
  frozen: boolean;
  maxRequest: number;
}

export function TeamForm(props: TeamFormProps) {
  const router = useRouter();
  const [requested, setRequested] = useState(props.requested);
  const [contactEmail, setContactEmail] = useState(props.contactEmail);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveRegistration({ requested, contactEmail });
      setMessage(result.success ? { ok: true, text: "saved" } : { ok: false, text: result.error });
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block space-y-1">
        <span className="label block">vouchers needed</span>
        <input
          type="number"
          min={0}
          max={props.maxRequest}
          value={requested}
          onChange={(e) => setRequested(Number(e.target.value))}
          required
          className="w-28"
        />
        <span className="block text-xs text-muted">
          {props.frozen && props.registered
            ? "The order is frozen. If you raise the number, the additional vouchers go to the back of every round."
            : "One per person who needs a ticket."}
        </span>
      </label>
      <label className="block space-y-1">
        <span className="label block">mail vouchers to</span>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          className="w-full"
          placeholder="team@example.org"
        />
        <span className="block text-xs text-muted">
          Someone has to read this quickly, vouchers expire if not redeemed within 24h.
        </span>
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn">
          {pending ? "saving…" : props.registered ? "update" : "register"}
        </button>
        {message && (
          <span className={`font-mono text-sm ${message.ok ? "text-ok" : "text-bad"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
