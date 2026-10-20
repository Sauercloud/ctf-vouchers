// Minimal .eml reader for tests and the fake-inbound script: turns a raw mail
// into the fields Mailgun's forward() would post. Only handles what the CCC
// mails use (multipart with an 8bit text/plain part).

export function parseEml(raw: string) {
  const text = raw.replace(/\r\n/g, "\n");
  const split = text.indexOf("\n\n");
  const head = text.slice(0, split);
  const body = text.slice(split + 2);

  const headers: [string, string][] = [];
  for (const line of head.split("\n")) {
    if (/^\s/.test(line) && headers.length) {
      headers[headers.length - 1][1] += " " + line.trim();
    } else {
      const i = line.indexOf(":");
      if (i > 0) headers.push([line.slice(0, i), line.slice(i + 1).trim()]);
    }
  }

  const plain = body.match(/Content-Type: text\/plain[^\n]*\n(?:[^\n]+\n)*\n([\s\S]*?)\n--=/);
  const get = (name: string) =>
    headers.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? "";

  return {
    headers,
    from: get("From"),
    subject: get("Subject"),
    messageId: get("Message-ID"),
    bodyPlain: plain ? plain[1] : body,
  };
}
