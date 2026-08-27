# SentriQ Migrations

**Project:** `pwomrtwoihtulautvjwv`  
**URL:** `https://pwomrtwoihtulautvjwv.supabase.co`

## Easiest path (recommended)

1. Open **SQL Editor** in your project dashboard.
2. Paste and run **`000_sentriq_full_schema.sql`** once (full schema + open RLS).
3. Auth → Providers → Email: turn **OFF** “Confirm email” for local signup.
4. Restart `npm run dev`.

## Or run step-by-step

`001` → `007` in order. Every table policy uses:

```sql
USING (true) WITH CHECK (true)
```

## Env

Already set in `.env`:

```
VITE_SUPABASE_URL=https://pwomrtwoihtulautvjwv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Live collar data still comes from Firebase RTDB (`device_id` match).
