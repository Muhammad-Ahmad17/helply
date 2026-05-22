-- Phase 2: atomic message quota consumption per bot/plan
create or replace function public.consume_message_quota(p_bot_id uuid)
returns table(allowed boolean, remaining int, plan text)
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  plan_limit int;
begin
  select * into b from public.bots where id = p_bot_id for update;
  if not found then
    return query select false, 0, 'unknown'::text;
    return;
  end if;

  if b.monthly_message_period_start < date_trunc('month', now()) then
    update public.bots
      set monthly_message_count = 0,
          monthly_message_period_start = date_trunc('month', now())
      where id = p_bot_id;
    b.monthly_message_count := 0;
  end if;

  plan_limit := case b.plan
    when 'free' then 500
    when 'starter' then 5000
    when 'pro' then 25000
    else 500
  end;

  if b.monthly_message_count >= plan_limit then
    return query select false, 0, b.plan;
    return;
  end if;

  update public.bots
    set monthly_message_count = monthly_message_count + 1
    where id = p_bot_id;

  return query select true, plan_limit - (b.monthly_message_count + 1), b.plan;
end;
$$;

grant execute on function public.consume_message_quota(uuid) to service_role;
