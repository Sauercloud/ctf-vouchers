import Link from "next/link";

export default function Home() {
  return (
    <div className="text-center">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold text-cyan-400 mb-4">
          Welcome to the 39C3 CTF Voucher Distribution Service!
        </h1>

        <div className="my-8 h-px bg-gray-700"></div>

        <p className="mb-6 max-w-2xl mx-auto">
          This is the official platform for CTF (Capture The Flag) teams to
          request and manage their ticket vouchers for the 39th Chaos
          Communication Congress (39C3). The Chaos Computer Club (CCC) is
          Europe&apos;s largest association of hackers, and the annual congress is a
          world-renowned four-day conference on technology, society, and utopia.
          To ensure a fair and organized distribution of vouchers for the
          upcoming 39C3 in Hamburg, we have created this service for registered
          CTF teams.
        </p>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 flex flex-col items-center">
          <h3 className="text-2xl font-bold mb-4 text-cyan-400">
            How It Works
          </h3>
          <ol className="text-left space-y-3 text-gray-300">
            <li className="flex items-start">
              <span className="bg-cyan-500 text-gray-900 rounded-full h-6 w-6 text-sm flex shrink-0 items-center justify-center font-bold mr-3">
                1
              </span>
              <p>
                Log in with your team&apos;s CTFTime account.
              </p>
            </li>
            <li className="flex items-start">
              <span className="bg-cyan-500 text-gray-900 rounded-full h-6 w-6 text-sm flex shrink-0 items-center justify-center font-bold mr-3">
                2
              </span>
              <p>You will be directed to your team dashboard.</p>
            </li>
            <li className="flex items-start">
              <span className="bg-cyan-500 text-gray-900 rounded-full h-6 w-6 text-sm flex shrink-0 items-center justify-center font-bold mr-3">
                3
              </span>
              <p>
                Fill out the form specifying the number of tickets your team
                would like to have and a contact email.
              </p>
            </li>
            <li className="flex items-start">
              <span className="bg-cyan-500 text-gray-900 rounded-full h-6 w-6 text-sm flex shrink-0 items-center justify-center font-bold mr-3">
                4
              </span>
              <p>
                You can come back and update this information any time before
                the deadline.
              </p>
            </li>
          </ol>
          <Link
            href="/dashboard"
            className="mt-6 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
