// Background worker: claims pending crawl_jobs (daily cron on Vercel Hobby).
import { NextResponse } from "next/server";
import { claimAndProcessJobs, verifyCronAuth } from "@/lib/crawl-worker";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const processed = await claimAndProcessJobs(10);
    return NextResponse.json({ processed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
