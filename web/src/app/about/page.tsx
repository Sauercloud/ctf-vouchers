import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-gray-800 shadow-lg rounded-lg p-8">
          <h1 className="text-4xl font-extrabold text-cyan-400 mb-6 tracking-tight">
            About the Voucher Distribution
          </h1>
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">
                Who is Eligible?
              </h2>
              <p>
                This voucher distribution service is intended for active members
                of the CTF (Capture The Flag) community who are planning to
                attend the 39th Chaos Communication Congress (39C3). Our goal is
                to support teams who contribute and participate in the and CTF
                community.
              </p>
              <p className="mt-2">
                If your team has organized or participated in at least one CTF
                your team is eligible.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-3">
                How Vouchers Are Distributed
              </h2>
              <p>
                The process is designed to be as fair and straightforward as
                possible. After logging in with your CTFtime.org account, your
                team captain or a designated representative should fill out the
                form on the dashboard.
              </p>
              <p className="mt-2">
                The number of tickets you request will not be the number of
                ticktes you receive. It is merely a reference and a maximum
                which we can share with the CCC if needed.
              </p>
              <p className="mt-2">
                After we receive the vouchers from the 39c3 team, we will begin
                distributing them to the teams that have registered prior to the
                deadline. Every day after we received the vouchers, we will go
                through all of the remaining registered teams and provide teams
                with two vouchers each that they need to redeem on the same day,
                while also specifying vorstand@alles.team as the recipient
                E-Mail of the replicated vouchers. This ensures that the
                vouchers will get replicated each day so that more CTF teams
                will have the chance to attend 39c3 - if any team does not
                follow this rule, they will be banned from any subsequent
                voucher distributions in the future.
              </p>
              <p className="mt-2">
                The sequence of teams receiving vouchers will be published{" "}
                <Link
                  href="/sequence"
                  className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-1 px-1 rounded-lg transition-colors"
                >
                  here
                </Link>
                . You will receive a mail with instructions to the mail you
                provided. Please make sure to but you tickets as soon as
                possible. Otherwise we may distribute those vouchers again and
                skip you.
              </p>
            </section>

            <div className="text-center pt-6">
              <Link
                href="/dashboard"
                className="inline-block bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
