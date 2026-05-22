export type SourceStatus = "pending" | "crawling" | "ready" | "error";

export interface Bot {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  welcome_message: string;
  system_prompt: string;
  primary_color: string;
  created_at: string;
}

export interface Source {
  id: string;
  bot_id: string;
  url: string;
  title: string | null;
  status: SourceStatus;
  error_message: string | null;
  last_crawled_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
