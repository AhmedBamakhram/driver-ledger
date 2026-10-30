# October 29 update

## Deploy in this order

1. Export your existing records before updating.
2. Open the existing Supabase project, SQL Editor. Run `upgrade-20261029.sql`. This adds two expense columns and an atomic daily-save function. It does not remove records. Existing RLS policies still apply.
3. Upload `app.js`, `index.html`, and `styles.css` together to the existing GitHub repository. Keep the existing Vercel configuration.
4. Wait for Vercel's deployment to be Ready, then reload the live website.
5. Sign in, save a test entry, and check its `Saved to cloud` status. Confirm it exists in Supabase. Test again after refresh.

## Reports

Previous/next arrows move the selected day, week, month or year. Comparison amounts are changes from the preceding equivalent period. Download report exports the selected dashboard totals and expense breakdown as CSV. The existing Export CSV button still exports history records.

Actual payments counts each saved expense on its payment date. Spread over coverage divides a payment by the exact number of calendar days it covers, including both endpoints. No expense is allocated outside its coverage dates. A week contains seven calendar days, including across daylight-saving changes.

Each saved expense is ONE payment. Record future payments separately; the frequency supplies a default coverage duration, not automatic future bills. Monthly defaults to one calendar month, Every 4 months to four months, and Yearly to twelve months. Explicit coverage dates override that default. A one-time payment without coverage dates counts on its payment date in both modes. Existing recurring entries now cover only one interval starting at their saved date; review them and enter missing actual payments.

## Saving

Each record shows Saving, Not synced, Saved locally, or Saved to cloud. Failed changes remain queued on this browser and can be retried with Sync now. Signed-in pending changes are tied to their account. Cloud loading preserves those changes. Signed-out changes are uploaded only after confirming the prompt on Sync now. Do not clear browser storage while changes are pending.

Daily saves use one database transaction for the day and platform earnings. Retrying replaces totals instead of adding fuel. Saving a date that already exists opens that record for editing; review and save its totals. Existing duplicate rows are retained for manual review; this update does not attempt to reconstruct previously inflated fuel values.

Sign-out is blocked while saving or while that account has unsynced changes. Successful sign-out clears the displayed cache without deleting cloud records.

## Verification

Run `node tests/report-sync.test.cjs` for calendar boundary, leap-year, coverage, payment and offline retry checks. The SQL migration must also be tested against your Supabase project after applying it; local tests cannot verify your deployed RLS policies or database permissions.
