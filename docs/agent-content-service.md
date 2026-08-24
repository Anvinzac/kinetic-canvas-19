# Agent Content Feed Service

The agent content feed is the API boundary between external data feeders and
scheduled bot publishers.

**Credential setup (Lovable / GitHub / Hub):**  
[`docs/lovable-auto-posting-credentials.md`](./lovable-auto-posting-credentials.md)

## Shape

- External feeder services write content into Supabase.
- Bot publishing functions claim one ready item, publish a post, then mark it used.
- The feed is generic: `vocabulary.en_vi` is the first source, but Sports,
  Entertainment, Food, and other agents can add their own `source_key`.

## Tables

- `agent_content_sources`: registry of content streams.
- `agent_content_items`: queued content items with JSON payloads and lifecycle status.

Item status:

- `ready`: available to publish.
- `claimed`: a bot function has reserved it inside a publish transaction.
- `used`: published into a post.
- `rejected`: intentionally excluded.

## Vocabulary Payload

```json
{
  "word": "Petrichor",
  "vi_definition": "Mùi đất thơm dịu sau cơn mưa đầu mùa.",
  "hints": ["Từ này bắt đầu bằng chữ P.", "Cả từ gồm 9 chữ cái.", "Đoán tiếp nào, bạn tìm ra chứ?"],
  "difficulty": "medium"
}
```

Use `content_key = lower(word)`. The database enforces one item per
`source_key + content_key`, so the same English word cannot be queued twice for
the same source.

## POST Content (preferred: system bot session)

The **content-hub** default sink (`SupabaseRpcSink`) does **not** use the service
role key. It:

1. Password-logs in with `SYSTEM_BOT_EMAIL` / `SYSTEM_BOT_PASSWORD` and `SUPABASE_ANON_KEY`
2. Calls `enqueue_agent_content_item` with that user’s JWT  
3. Requires `profiles.is_system = true` for that user (RLS)

Manual equivalent:

```bash
# 1) Get a user access token
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SYSTEM_BOT_EMAIL\",\"password\":\"$SYSTEM_BOT_PASSWORD\"}" \
  | jq -r .access_token)

# 2) Enqueue
curl "$SUPABASE_URL/rest/v1/rpc/enqueue_agent_content_item" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "p_source_key": "vocabulary.en_vi",
    "p_content_key": "petrichor",
    "p_payload": {
      "word": "Petrichor",
      "vi_definition": "Mùi đất thơm dịu sau cơn mưa đầu mùa.",
      "hints": [
        "Từ này bắt đầu bằng chữ P.",
        "Cả từ gồm 9 chữ cái.",
        "Đoán tiếp nào, bạn tìm ra chứ?"
      ],
      "difficulty": "medium"
    }
  }'
```

### Alternate: service role (ops / one-off only)

Never expose `service_role` to the browser or the Hub’s default env. Use only from
a trusted server or SQL/scripting session:

```bash
curl "$SUPABASE_URL/rest/v1/rpc/enqueue_agent_content_item" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{ ... same body ... }'
```

## GET Queue Health

As system bot (or service role for ops):

```bash
curl "$SUPABASE_URL/rest/v1/agent_content_items?source_key=eq.vocabulary.en_vi&status=eq.ready&select=id,content_key,available_at" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TOKEN"
```

## Publishing

The scheduled job calls:

```sql
SELECT public.publish_vocabulary_bot_post(now());
```

That function:

- calculates the Vietnam-time posting slot,
- refuses duplicate slot posts for the same day,
- claims the next ready `vocabulary.en_vi` item,
- refuses words already published by `do_chu_bot`,
- creates the kinetic post,
- marks the content item as `used`.

Cron job name: `kinetic-vocabulary-bot-3x-daily` (`0 1,7,13 * * *` UTC).

## When To Split Into A Dedicated Backend

Keep this Supabase-backed feed while the service is mostly queueing curated data.
Move the feeder into a dedicated always-on backend when it needs any of these:

- LLM generation with retries and moderation.
- Calls to external dictionaries/news/sports APIs.
- Rate-limit handling and backoff.
- Long-running enrichment jobs.
- Admin dashboards for reviewing generated content.
- Multi-step workflows before content becomes publishable.

The dedicated backend should still POST into this same content feed API, so bot
publishing does not need to change.
