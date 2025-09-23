"use client";

import { useState, FormEvent, startTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFormRequest } from "@/actions/form";

interface TicketFormProps {
  currentData: {
    tickets: number;
    contactEmail: string;
  };
}

export const TicketForm = ({ currentData }: TicketFormProps) => {
  const router = useRouter();
  const [tickets, setTickets] = useState(currentData.tickets);
  const [contactEmail, setContactEmail] = useState(currentData.contactEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const result = await saveFormRequest(tickets, contactEmail);

    if (result.success) {
      setMessage({
        type: "success",
        text: "Your request has been saved successfully!",
      });
    } else {
      setMessage({ type: "error", text: result.error ?? "Unkown error" });
    }

    // Refresh server components with new data
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="tickets"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Number of Vouchers
        </label>
        <input
          id="tickets"
          name="tickets"
          type="number"
          min="0"
          value={tickets}
          onChange={(e) => setTickets(Number(e.target.value))}
          required
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>
      <div>
        <label
          htmlFor="contactMail"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Contact Email Address
        </label>
        <input
          id="contactMail"
          name="contactMail"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="contact@your-team.com"
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {isLoading ? "Saving..." : "Save Request"}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-center ${
            message.type === "success"
              ? "bg-green-800 text-green-200"
              : "bg-red-800 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}
    </form>
  );
};
