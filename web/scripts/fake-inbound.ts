// Posts a signed fake Mailgun forward() request, for local testing.
//
//   MAILGUN_SIGNING_KEY=dev yarn fake-inbound <recipient> [options]
//     --eml <file>     use a raw mail (e.g. test/fixtures/ccc-voucher.eml)
//     --text <body>    use this plain text body
//     --code <code>    replace the code in the body with this one
//     --from <addr>    override the From header
//     --dkim           add "X-Mailgun-Dkim-Check-Result: Pass"
//     --url <url>      default http://localhost:3000/api/mailgun/inbound

import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEml } from "./eml";

const args = process.argv.slice(2);
const recipient = args.shift();
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!recipient) {
  console.error("usage: fake-inbound <recipient> [--eml file] [--text body] [--code code] [--from addr] [--dkim]");
  process.exit(1);
}

const mail = opt("eml")
  ? parseEml(readFileSync(opt("eml")!, "utf8"))
  : { headers: [] as [string, string][], from: "", subject: "test", messageId: "", bodyPlain: opt("text") ?? "" };

const code = opt("code");
const bodyPlain = code ? mail.bodyPlain.replace(/\bCHAOS[A-Z0-9]{32}\b/g, code) : mail.bodyPlain;
const from = opt("from") ?? (mail.from || "someone@example.org");
const headers = [...mail.headers.filter(([k]) => k.toLowerCase() !== "from"), ["From", from]];
if (args.includes("--dkim")) headers.push(["X-Mailgun-Dkim-Check-Result", "Pass"]);

const timestamp = String(Math.floor(Date.now() / 1000));
const token = randomBytes(25).toString("hex");
const signature = createHmac("sha256", process.env.MAILGUN_SIGNING_KEY ?? "dev")
  .update(timestamp + token)
  .digest("hex");

const form = new URLSearchParams({
  recipient,
  sender: from,
  from,
  subject: mail.subject,
  "body-plain": bodyPlain,
  "message-headers": JSON.stringify(headers),
  "Message-Id": `<${randomBytes(8).toString("hex")}@fake>`,
  timestamp,
  token,
  signature,
});

fetch(opt("url") ?? "http://localhost:3000/api/mailgun/inbound", { method: "POST", body: form })
  .then(async (res) => console.log(res.status, await res.text()))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
