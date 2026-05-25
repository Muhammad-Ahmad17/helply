export type SourceStatus = "pending" | "crawling" | "ready" | "error";
export type BotPlan = "free" | "starter" | "pro";
export type CrawlJobStatus = "pending" | "running" | "done" | "error";

export interface Bot {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  welcome_message: string;
  system_prompt: string;
  primary_color: string;
  allowed_origins: string[];
  plan: BotPlan;
  monthly_message_count: number;
  monthly_message_period_start: string;
  quota_alert_sent: string;
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

export interface CrawlJob {
  id: string;
  bot_id: string;
  source_id: string | null;
  url: string;
  status: CrawlJobStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface UserProfile {
  user_id: string;
  plan: BotPlan;
  is_admin: boolean;
  lemon_customer_id: string | null;
  lemon_subscription_id: string | null;
  updated_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const PLAN_LIMITS: Record<BotPlan, { messages: number; pages: number; bots: number }> = {
  free: { messages: 500, pages: 100, bots: 1 },
  starter: { messages: 5000, pages: 1000, bots: 3 },
  pro: { messages: 25000, pages: 10000, bots: 10 },
};
