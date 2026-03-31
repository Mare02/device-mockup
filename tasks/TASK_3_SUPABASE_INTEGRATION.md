# TASK 3: Supabase Integration & Saving Projects

## Objective
Integrate Supabase for database storage and image persistence. Focus on performance via .webp optimization.

## Requirements
- [ ] Install Supabase: `pnpm add @supabase/supabase-js`.
- [ ] Setup Supabase client in `src/lib/supabase.ts`.
- [ ] **Database Schema**:
    - [ ] Create `projects` table (id, user_id, name, config_json, thumbnail_url).
    - [ ] Create `mockups` table (id, project_id, screenshot_url, settings_json).
- [ ] **Storage Bucket**:
    - [ ] Create a public/private bucket for `screenshots`.
- [ ] **Image Optimization**:
    - [ ] Client-side conversion of `.png`/`.jpg` to `.webp` before uploading.
    - [ ] Resize large images to reasonable widths (e.g., 2000px max).
- [ ] **Persistence**:
    - [ ] Implement "Save Project" functionality (Upsert to DB).
    - [ ] Implement "Load Project" functionality (Fetch from DB).

## Notes
- Use the `.webp` format to keep the 1GB free tier healthy for as long as possible.
- Store complex canvas state in a JSONB column in Postgres.
