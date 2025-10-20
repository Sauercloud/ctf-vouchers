"use client";

import { getSequence } from "@/actions/sequence";
import { useEffect, useState } from "react";

export default function SequencePage() {
  const [sequence, setSequence] = useState<string[][]>();

  useEffect(() => {
    (async () => {
      const s = await getSequence();
      setSequence(s.sequence);
    })();
  }, []);

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-gray-800 shadow-lg rounded-lg p-8">
          <h1 className="text-4xl font-extrabold text-cyan-400 mb-6 tracking-tight">
            Sequence of teams
          </h1>

          {sequence?.map((names, i) => (
            <div key={i}>
              <h2 className="text-2xl font-semibold text-white mb-3 mt-3">
                Voucher Count {i * 2}
              </h2>
              {names.map((name, i) => (
                <div key={i}>{name}</div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
