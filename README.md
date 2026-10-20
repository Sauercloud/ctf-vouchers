# ctf-vouchers

Distributes the 40C3 group vouchers within the CTF community: teams register
with CTFtime, the order is frozen and shuffled when the first vouchers
arrive, and every voucher is mailed automatically through Mailgun with a
unique replication address (`v-<token>@ctf-vouchers.de`) and a confirmation
Reply-To (`c-<token>@ctf-vouchers.de`).

## Flow

1. Teams log in with CTFtime and register (count + contact email).
2. An admin forwards the CCC mail with the initial codes to
   `seed-<SEED_SECRET>@ctf-vouchers.de`. The first such mail freezes the
   order (seed `SHUFFLE_SEED`, published on `/sequence`). Its SHA-256 is
   shown on `/` and `/sequence` before that, so never change `SHUFFLE_SEED`
   once the site is public.
3. Every voucher goes to the next slot (2 per team per round) and is mailed.
   Teams keep their shuffled place for what they asked for at the freeze.
   Late registrations and raises after the freeze queue at the back of every
   round, ordered by time (a later raise queues only the newly added vouchers).
   The team redeems it with the unique replication address and replies to the
   mail to confirm.
4. The CCC mails the replicated voucher to `v-<token>@`. It is accepted
   automatically if it comes from `@cccv.de` with a valid DKIM signature that
   covers `To: v-<token>@`, was made after the assignment and the code is new,
   otherwise held for an admin. Then it goes to the next slot.
5. A timer (`vouchers-tick`, every minute) sends the outbox (max
   `DAILY_SEND_LIMIT`, default 95/day for the Mailgun free tier) and flags
   assignments that are unconfirmed after `CONFIRM_HOURS` or have no replica
   after `OVERDUE_HOURS` once a later bank run happened (hard limit
   `OVERDUE_HARD_HOURS`). Flags mail `ADMIN_EMAIL`, nothing is reassigned
   automatically. Clearing the flags restarts these timers. Mails that may or
   may not have reached Mailgun (timeout, crash) are marked failed instead of
   resent.

Admins handle exceptions on `/admin` (nginx basic auth): release held
vouchers, enter codes from unparsed mails, mark confirmed, revoke/reassign,
resend, ban teams.

## Setup before deploying

- `sops host/secrets.yaml`:
  - `vouchers-env` (dotenv) needs, in addition to `AUTH_CTFTIME_SECRET` and
    `NEXTAUTH_SECRET`: `MAILGUN_API_KEY`, `MAILGUN_SIGNING_KEY` (HTTP webhook
    signing key), `SHUFFLE_SEED`, `SEED_SECRET` (lowercase letters/digits),
    `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_SENDER_ALLOWLIST` (addresses allowed
    to forward seed mails, comma separated).
  - `admin-htpasswd`: output of `htpasswd -nB <user>`.
- Mailgun: add the domain `ctf-vouchers.de` (EU region, otherwise change
  `MAILGUN_API_BASE`), set the MX, SPF and DKIM DNS records it shows, and
  create one route: `match_recipient(".*@ctf-vouchers.de")` →
  `forward("https://ctf-vouchers.de/api/mailgun/inbound")`, `stop()`.
  Disable click/open tracking.
- Deploy with `./upgrade.sh`. Migrations run on service start.

## (Re)installing the server

The disk layout lives in `host/disko.nix` (GPT, BIOS boot partition, ext4
root on `/dev/sda`). `./install.sh [root@host]` wipes the disk and installs
with nixos-anywhere. It keeps the SSH host key, so sops secrets still decrypt,
and dumps the old database to `vouchers-backup-<date>.sql` first.

The old server still uses the MBR `/dev/sda1` layout. Don't run
`./upgrade.sh` against it before reinstalling with `./install.sh`, or it will
not boot (the filesystems now point at disko partition labels).

## Development

```sh
nix develop
cd web
yarn install
yarn test            # unit tests (ordering, parsing, flag rules)
DATABASE_URL=postgresql://... yarn prisma migrate deploy
ADMIN_DEV_BYPASS=1 SHUFFLE_SEED=dev SEED_SECRET=dev MAILGUN_SIGNING_KEY=dev CRON_SECRET=dev yarn dev
# simulate mails (signed like Mailgun)
yarn fake-inbound seed-dev@ctf-vouchers.de --text "CHAOS..."
yarn fake-inbound v-<token>@ctf-vouchers.de --eml test/fixtures/ccc-voucher.eml --code CHAOS... --dkim
curl -X POST -H "Authorization: Bearer dev" localhost:3000/api/cron/tick
```

Without `MAILGUN_API_KEY` mails are only logged.

After changing dependencies, update the `fetchYarnDeps` hash in
`package.nix`. Keep `prisma` pinned to the `prisma-engines` version in
nixpkgs.
