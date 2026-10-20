import { config } from "@/lib/config";
import { tick } from "@/lib/tick";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  return Response.json(await tick());
}
