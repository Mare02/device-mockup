# TASK 1: User Authentication (Clerk + Astro)

## Objective
Implement Clerk authentication to manage users and sync their basic data to Supabase.

## Requirements
- [ ] Install Clerk: `pnpm add @clerk/astro`.
- [ ] Update `.env` with `PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
- [ ] Update `astro.config.mjs` with the Clerk integration.
- [ ] Create `src/middleware.ts` to handle auth on server routes.
- [ ] Implement `SignedIn`, `SignedOut`, and `UserButton` in `src/pages/app.astro`.
- [ ] Create a Supabase webhook or direct sync function to save newly signed-up users to the `users` table.

## Notes
- Host users in Clerk for security.
- Store a reference of the user in Supabase (`id`, `email`, `last_login`).
- Ensure the user experience is "app-like" by using Clerk's `<UserButton />`.
