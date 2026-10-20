import { config } from "@/lib/config";
import { processInbound } from "@/lib/inbound";
import { verifySignature } from "@/lib/mailgun";
import { header, parseHeaders } from "@/lib/parse";
import { prisma } from "@/lib/prisma";

// Target of the Mailgun route forward(). Mailgun retries on non-2xx responses.
export async function POST(request: Request) {
  const form = await request.formData();
  const field = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };

  if (
    !verifySignature(
      config.mailgunSigningKey,
      field("timestamp"),
      field("token"),
      field("signature"),
    )
  ) {
    return new Response("invalid signature", { status: 406 });
  }

  const headers = parseHeaders(field("message-headers"));
  const messageId =
    field("Message-Id") || header(headers, "message-id") || `token:${field("token")}`;

  const result = await prisma.$transaction(
    (tx) =>
      processInbound(tx, {
        messageId,
        recipient: field("recipient"),
        sender: field("sender"),
        from: field("from") || field("From"),
        subject: field("subject"),
        bodyPlain: field("body-plain"),
        headers,
      }),
    { timeout: 30_000 },
  );
  return Response.json(result);
}
