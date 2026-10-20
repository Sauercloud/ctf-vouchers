// Runtime configuration, read from the environment on every access so tests
// and scripts can override it.

const str = (name: string, fallback = "") => process.env[name] ?? fallback;
const num = (name: string, fallback: number) => {
  const v = process.env[name];
  return v ? Number(v) : fallback;
};
const list = (name: string, fallback = "") =>
  str(name, fallback)
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

export const config = {
  get mailDomain() {
    return str("MAILGUN_DOMAIN", "ctf-vouchers.de");
  },
  get mailgunApiBase() {
    return str("MAILGUN_API_BASE", "https://api.eu.mailgun.net");
  },
  get mailgunApiKey() {
    return str("MAILGUN_API_KEY");
  },
  get mailgunSigningKey() {
    return str("MAILGUN_SIGNING_KEY");
  },
  // Without an API key mails are only logged.
  get mailDryRun() {
    return !this.mailgunApiKey || str("MAIL_DRY_RUN") === "1";
  },
  get mailFrom() {
    return str("MAIL_FROM", `CTF Vouchers <vouchers@${this.mailDomain}>`);
  },
  get adminEmail() {
    return str("ADMIN_EMAIL");
  },
  get dailySendLimit() {
    return num("DAILY_SEND_LIMIT", 95);
  },
  get voucherCodeRegex() {
    return str("VOUCHER_CODE_REGEX", "\\bCHAOS[A-Z0-9]{32}\\b");
  },
  get cccSenderAllowlist() {
    return list("CCC_SENDER_ALLOWLIST", "@cccv.de");
  },
  get requireDkim() {
    return str("REQUIRE_DKIM", "1") === "1";
  },
  // Senders allowed to forward the initial vouchers. Empty allows everyone,
  // the secret address is the main protection.
  get adminSenderAllowlist() {
    return list("ADMIN_SENDER_ALLOWLIST");
  },
  get seedSecret() {
    return str("SEED_SECRET");
  },
  get shuffleSeed() {
    return str("SHUFFLE_SEED");
  },
  get cronSecret() {
    return str("CRON_SECRET");
  },
  get confirmHours() {
    return num("CONFIRM_HOURS", 6);
  },
  get overdueHours() {
    return num("OVERDUE_HOURS", 24);
  },
  get overdueHardHours() {
    return num("OVERDUE_HARD_HOURS", 96);
  },
  get maxRequest() {
    return num("MAX_REQUEST", 30);
  },
  get perRound() {
    return num("VOUCHERS_PER_ROUND", 2);
  },
  // The CCC's voucher phase, as announced in the presale modus operandi.
  // The first vouchers arrive at its start.
  get voucherPhaseStart() {
    return new Date(str("VOUCHER_PHASE_START", "2026-10-23T10:00:00+02:00"));
  },
  get voucherPhaseEnd() {
    return new Date(str("VOUCHER_PHASE_END", "2026-11-10T23:00:00+01:00"));
  },
  get presaleInfoUrl() {
    return str("PRESALE_INFO_URL", "https://events.ccc.de/en/2026/10/19/40c3-presale-modus-operandi/");
  },
  get baseUrl() {
    return str("NEXTAUTH_URL", "http://localhost:3000");
  },
  get adminDevBypass() {
    return process.env.NODE_ENV !== "production" && str("ADMIN_DEV_BYPASS") === "1";
  },
};
