import { confirmAddress, replicaAddress } from "@/lib/addresses";
import { config } from "@/lib/config";

export function voucherMail(teamName: string, code: string, token: string) {
  const replica = replicaAddress(token);
  const confirm = confirmAddress(token);
  return {
    subject: `[40C3] Your CTF community voucher`,
    replyTo: confirm,
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

3. As soon as you redeemed the voucher, confirm it by sending a mail to this
   address (any text works, e.g. "redeemed"):

     ${confirm}

   Replying to this mail usually works too, since replies go to that
   address. But if this mail was forwarded to you, a reply may end up with
   whoever forwarded it, so write to the address above directly.

   Don't confuse the two addresses: the one in step 1 (starting with "v-")
   is only for the CCC, the one here (starting with "c-") is for you.

Each voucher is good for one ticket.

If you can't use the voucher, do NOT confirm it. Instead press "can't use it,
give back" on your team dashboard right away so we can pass it on to the next
team:

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
