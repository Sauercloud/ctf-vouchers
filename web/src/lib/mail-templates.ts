import { confirmAddress, replicaAddress } from "@/lib/addresses";
import { config } from "@/lib/config";

export function voucherMail(teamName: string, code: string, token: string) {
  const replica = replicaAddress(token);
  return {
    subject: `[40C3] Your CTF community voucher`,
    replyTo: confirmAddress(token),
    text: `Hi ${teamName},

your team is next in line for a 40C3 voucher from the CTF community pool:

  ${code}

Please do the following, in this order:

1. Redeem the voucher at https://tickets.events.ccc.de/ within 24 hours.
   When asked for the email address to send the replicated voucher to, enter
   exactly this address (it is unique to this voucher):

     ${replica}

2. Pay right away using the fastest payment method available. The CCC only
   creates the next voucher for the community once your ticket is paid.

3. Reply to this mail as soon as possible to confirm that you redeemed the
   voucher. Any text works, e.g. "redeemed".

Each voucher is good for one ticket.

If you can't use the voucher, do NOT reply. Instead press "can't use it, give
back" on your team dashboard right away so we can pass it on to the next team:

  ${config.baseUrl}/dashboard

Teams that keep a voucher without passing on the replicated voucher will be
excluded from future distributions.

Thanks and see you at 40C3!
CTF Vouchers
`,
  };
}

export function adminAlertMail(lines: string[]) {
  return {
    subject: `[ctf-vouchers] ${lines.length} item(s) need attention`,
    text: `${lines.map((l) => `- ${l}`).join("\n")}\n\n${config.baseUrl}/admin\n`,
  };
}
