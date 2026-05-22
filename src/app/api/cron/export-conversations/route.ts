// Weekly backup: export recent conversations to Supabase Storage
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { log, logError } from "@/lib/log";

import { verifyCronAuth } from "@/lib/crawl-worker";

export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, bot_id, visitor_id, ip_hash, created_at, messages(id, role, content, created_at)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    logError("export_conversations_failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filename = `backups/conversations-${new Date().toISOString().slice(0, 10)}.json`;
  const body = JSON.stringify({ exported_at: new Date().toISOString(), count: conversations?.length ?? 0, conversations }, null, 2);

  const { error: uploadError } = await supabase.storage
    .from("helply-backups")
    .upload(filename, body, { contentType: "application/json", upsert: true });

  if (uploadError) {
    log({ level: "warn", msg: "backup_storage_missing", error: uploadError.message });
    return NextResponse.json({
      ok: true,
      warning: "Storage bucket 'helply-backups' not found — create it in Supabase Dashboard",
      count: conversations?.length ?? 0,
    });
  }

  log({ msg: "conversations_exported", count: conversations?.length ?? 0, filename });
  return NextResponse.json({ ok: true, filename, count: conversations?.length ?? 0 });
}
