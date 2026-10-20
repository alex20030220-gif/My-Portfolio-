# Portfolio contact form

The contact page submits enquiries to the `portfolio-contact` Supabase Edge Function. Messages are saved in `public.contact_requests`.

## Read and follow up

Open the [Supabase Table Editor](https://supabase.com/dashboard/project/vhxubphfoqryqsbfrgpk/editor), choose `contact_requests`, and sort `created_at` from newest to oldest. Each row contains the visitor's name, email, optional phone number, request, consent, and creation time. Use `status` to track `new`, `contacted`, or `closed`.

Alex chose to review messages in Supabase. Automatic email notifications are not enabled.

## Access and submission behavior

The table has Row Level Security enabled and grants no access to anonymous or signed-in website visitors. The storage function can only be executed by the server's service role. The public Edge Function checks fields, payload size, consent, and browser origin before writing. It does not return stored messages or database errors to visitors. Server secrets stay in the Supabase runtime.

The request UUID prevents duplicate records when a visitor retries a failed connection. A hidden honeypot and a five-message limit per 15 minutes for each daily salted network hash reduce automated submissions. This is basic abuse protection; a determined bot can require an additional CAPTCHA or gateway limit later. No raw IP address is saved.

The RLS advisor may report the informational notice `rls_enabled_no_policy`. This is intentional: there are no public access policies because all database writes are made by the private server function.

## Source

- `supabase/contact-requests.sql`: schema, permissions, and the storage function already applied to the project.
- `supabase/functions/portfolio-contact/index.ts`: deployed Edge Function.
- `supabase/config.toml`: public function configuration. A Supabase login is not required to send an enquiry.
- `index.html`: complete deployed frontend, including the form, validation, sending, success, and error states.

Review messages regularly and delete them when no longer needed. Remove a visitor's message if they request deletion using the contact address displayed on the website.
