# Driver Ledger MVP

Last updated: November 13, 2026.

See [UPDATE-GUIDE.md](UPDATE-GUIDE.md) for the October report and sync update, and [MAINTENANCE-GUIDE.md](MAINTENANCE-GUIDE.md) for the maintenance database setup. The November 13 History update needs only the three website files; no new SQL is required.

Driver Ledger is a simple web app for self-employed rideshare drivers who use their own car. It tracks daily income, trips, hours, kilometres, fuel, and other business expenses so the driver can see gross income, expenses, and net profit.

This document records what was built, what problems were found, and how the current GitHub + Vercel + Supabase setup works.

## Recent Updates

### Vehicle Maintenance — November 11, 2026

- Added vehicles with a current odometer reading and reading date.
- Added completed service records with vehicle, service type, date, odometer, cost, optional note and HTTPS receipt link.
- Search by vehicle or service type to see the last recorded service and kilometres driven since.
- Display **Service history unknown** when there is no completed service record.
- Display reminders using the manufacturer guidance entered by the driver, or the dashboard reminder entered in the form. The app does not automatically look up manufacturer schedules or connect to the vehicle.
- Store vehicle and service records in Supabase's `maintenance_items` table, protected by an account-owner Row Level Security policy. Local changes use the existing sync retry queue.

Current service options: Engine oil, Transmission fluid, Differential fluid, Brake inspection, Brake replacement, Tire rotation, and Other service.

Differential fluid was added after the initial maintenance release. Oil filter was removed from new service options; existing oil-filter records are preserved and can still be edited. Record new oil-filter work in the engine oil notes, and identify front/rear differential work in the notes.

**Current limits:** Update each vehicle's odometer manually; daily driving entries are not assigned to vehicles. Receipt attachments are links, not file uploads. Maintenance costs are a separate service log: add the payment once under Other costs to include it in net income. Existing financial expenses are not automatically treated as confirmed service history.

### Shorter History — November 13, 2026

- Show the newest 20 financial history records initially.
- **Show 20 more** reveals the next 20.
- **Show 20 fewer** reduces the visible list by 20, with a minimum of 20 where available.
- Show a count such as **Showing 20 of 145 records**.
- Search checks all history records, including hidden rows, and starts with the first 20 matches.
- Hiding rows does not delete data or change dashboard calculations.
- CSV exports keep their existing behaviour; they are not limited to the visible 20 rows.

These controls apply to Saved records → History, not the separate maintenance history.

## Publishing These Updates

| Update | Supabase action | GitHub files |
| --- | --- | --- |
| Initial maintenance section | Run `upgrade-20261111-maintenance.sql` once in the existing project's SQL Editor | `app.js`, `index.html`, `styles.css` |
| Differential fluid / service-option change | None | `app.js` |
| History: 20 records at a time | None | `app.js`, `index.html`, `styles.css` |
| Documentation only | None | `README.md` |

1. For the initial maintenance setup, run the SQL and check for **Success. No rows returned**. This applies the database changes immediately; saving the query only keeps the SQL text for reference. The user reported this step completed.
2. Upload the updated website files together to the existing GitHub repository, replacing the files with the same names.
3. Click **Commit changes**. Uploading without committing does not publish the changes.
4. Vercel automatically deploys the committed code. Wait for the newest deployment to show **Ready**.
5. Refresh the live website. If necessary, use **Ctrl + Shift + R**.
6. Check History controls and Vehicle Maintenance. After saving a record, check its cloud status and refresh to confirm it remains.

Uploading a SQL file to GitHub does not execute it in Supabase. The History update does not require rerunning the maintenance SQL. Documentation changes do not alter saved records.

The maintenance section was verified on the live website during setup. The latest History changes were checked locally; verify the live deployment after uploading.

## Recent Setup Problems and Solutions

### Maintenance table missing

The app reported `PGRST205`: it could not find `public.maintenance_items`. Run the maintenance SQL in the same Supabase project used by the app, then refresh and retry sync.

### SQL syntax error on the first line

The pasted introductory comment started with one dash. SQL comments need two dashes (`--`). Remove the introductory comment or correct it, keep the SQL beginning with `begin;`, and run the full script.

### Maintenance section not visible

GitHub had the new JavaScript but an old `index.html`, which did not contain the maintenance section. Uploading the matching HTML fixed the missing section. Keep the three website files together for updates that change structure, behaviour and styling.

The section is at the bottom of the same website. [Open Vehicle Maintenance](https://driver-ledger-ruby.vercel.app/#maintenanceSection).

### History became too long

Added progressive display in groups of 20. Searching still checks all records, and report calculations remain independent of how many rows are displayed.

## Current Status

- App code is stored in GitHub.
- Local app URL for laptop testing: `http://localhost:3000`
- Live Vercel app URL: `https://driver-ledger-ruby.vercel.app`
- Cloud database/auth provider: Supabase
- Supabase project ref: `pzntppeunrpxerbxjdma`
- Supabase project URL: `https://pzntppeunrpxerbxjdma.supabase.co`
- Supabase key used in the browser app: publishable key only
- Email confirmation is OFF for MVP testing.

Important: Supabase stores the data only after the user signs in and sync works. Before sign-in, records are saved in browser local storage on the laptop.

## Architecture

Current production-style setup:

```text
GitHub -> Vercel website -> Supabase database/auth
```

- GitHub stores the app code.
- Vercel hosts the live website.
- Supabase stores users, daily entries, platform earnings, expenses, and vehicle maintenance records.
- The laptop local server is only for local testing.

## Files

- `index.html` - app page structure
- `styles.css` - app design and layout
- `app.js` - app logic, calculations, local storage, Supabase sync
- `server.js` - small local server for `http://localhost:3000`
- `vercel.json` - Vercel hosting config for the static website
- `.vercelignore` - tells Vercel not to deploy the local-only server file
- `README.md` - this setup/reference document
- `upgrade-20261029.sql` - expense coverage fields and atomic daily-save function
- `upgrade-20261111-maintenance.sql` - account-scoped vehicle and service storage
- `UPDATE-GUIDE.md` - report and cloud-sync update instructions
- `MAINTENANCE-GUIDE.md` - maintenance setup instructions

## How To Run Locally

From the `rideshare-income-tracker` folder, run:

```powershell
node server.js
```

Then open:

```text
http://localhost:3000
```

If the URL stops working, the local server probably stopped. Start `server.js` again.

## What The App Tracks

Daily entry:

- Date
- Uber income
- Uber trips
- Lyft income
- Lyft trips
- Hours worked
- Odometer start
- Odometer end
- Fuel
- Notes

Other expenses:

- Insurance
- Car payment or lease
- Oil change
- Maintenance or repair
- Tolls
- ETR 407
- Parking
- Phone and data
- Cleaning
- Washing car
- Other

Expense frequency:

- One time
- Monthly
- Every 4 months
- Yearly

**Actual payments** counts the full payment when its date is inside the report period. **Spread over coverage** allocates the payment by overlapping calendar days in its coverage period. Each payment is recorded separately; future payments are not generated automatically.

## Dashboard Reports

The dashboard can show:

- Day
- Week
- Month
- Year
- Custom range
- All records

It calculates:

- Gross income
- Total expenses
- Net income
- Business kilometres
- Cost per km
- Income per hour
- Profit per hour
- Profit per km
- Trips
- Average per trip
- App income breakdown
- Expense breakdown

## Data Storage

There are two storage layers.

### 1. Browser local storage

Used when the driver is not signed in, or as a local backup.

Current local storage keys:

- `driver-ledger-records-v1`
- `driver-ledger-expenses-v1`
- `driver-ledger-settings-v1`
- `driver-ledger-day-draft-v1`
- `driver-ledger-supabase-session-v1`
- `driver-ledger-pending-v2`
- `driver-ledger-maintenance-v1`

Risk: if browser data is cleared, local-only records can be deleted.

### 2. Supabase cloud database

Used after the driver signs in and cloud sync works.

Supabase stores:

- Daily entries
- Platform earnings
- Expenses
- User authentication
- Vehicles and completed maintenance services

This is the important long-term storage.

## Supabase Setup

Created a Supabase organization/project for Driver Ledger.

Project ref:

```text
pzntppeunrpxerbxjdma
```

Project URL:

```text
https://pzntppeunrpxerbxjdma.supabase.co
```

Only the publishable browser key should be used in `app.js`. Do not put secret keys, service role keys, JWT secrets, or database passwords in the frontend code or GitHub.

## Supabase Database SQL

The following is the original table structure for reference, not a complete fresh-install script. The later SQL update files add expense coverage fields, the daily-save function, and maintenance storage. Existing financial-table RLS policies are also required.

```sql
create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  work_date date not null,
  hours_worked numeric default 0,
  odometer_start numeric default 0,
  odometer_end numeric default 0,
  fuel_cost numeric default 0,
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists public.platform_earnings (
  id uuid primary key default gen_random_uuid(),
  daily_entry_id uuid not null references public.daily_entries(id) on delete cascade,
  platform_name text not null,
  gross_income numeric default 0,
  trips integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  expense_date date not null,
  category text not null,
  amount numeric default 0,
  frequency text not null default 'one-time',
  notes text default '',
  created_at timestamptz default now()
);
```

Row Level Security was enabled so each signed-in user should only access their own data.

## Supabase Auth Settings

For local MVP testing:

- Email provider: ON
- Confirm email: OFF
- Anonymous sign-ins: OFF

Why Confirm email is OFF:

- During local testing, confirmation links can be confusing because they redirect to `localhost`.
- Old confirmation links expire.
- Too many email attempts can trigger Supabase rate limits.

When the app is published online later, turn Confirm email back ON and update Supabase URL settings to the real website domain.

## Supabase Redirect URL

For local testing, Supabase URL Configuration can use:

```text
http://localhost:3000
```

This means Supabase sends the browser back to the app running on the same laptop.

Important: `localhost` does not mean Supabase can access the laptop. It means "this same device" in the browser.

For the current Vercel deployment, Supabase URL Configuration should use:

```text
https://driver-ledger-ruby.vercel.app
```

This URL should be set in both:

- Site URL
- Redirect URLs

For public use later with a custom domain, replace it with the final domain, for example `https://driverledger.ca`.

## Challenges And Solutions

### 1. Browser storage could be erased

Problem:

The first version saved records in browser local storage. If Chrome data was cleared, local-only records could be lost.

Solution:

Supabase was added as the cloud database. After sign-in, saved records sync to Supabase instead of depending only on browser storage.

### 2. Email confirmation caused login problems

Problem:

Supabase confirmation links expired, opened the wrong location, or showed `Email not confirmed`.

Solution:

For MVP testing, Confirm email was turned OFF in Supabase. Old unconfirmed users were deleted or manually confirmed. Supabase redirect settings were updated after Vercel deployment.

### 3. Supabase session token expired

Problem:

The app showed `JWT expired` after an old Supabase login token expired.

Solution:

The app was updated to save Supabase refresh tokens and refresh the session when needed.

### 4. Supabase returned empty success responses

Problem:

Sync showed `Unexpected end of JSON input` because some successful Supabase requests returned an empty body.

Solution:

The cloud request handler was updated to accept empty successful responses instead of trying to parse them as JSON.

### 5. `localhost` stopped working

Problem:

The local app URL `http://localhost:3000` only worked while the laptop server was running. If the server stopped, Chrome showed `localhost refused to connect`.

Solution:

The app was deployed to Vercel, creating a real website URL that does not require starting `server.js` manually.

### 6. Vercel deployed the local server incorrectly

Problem:

Vercel tried to run `server.js` as a serverless function and showed `FUNCTION_INVOCATION_FAILED`.

Solution:

`vercel.json` was added to serve the project as a static website, and `.vercelignore` was added so Vercel ignores the local-only `server.js` file.

### 7. Old daily draft changed today's date

Problem:

The daily entry form showed an old date because an unsaved draft restored an older entry.

Solution:

New daily entries default to today's date. An unsaved draft may restore an older date to preserve the driver's work; check the date before saving.

### 8. Same-day records split into two rows

Problem:

Saving income and fuel separately for the same day created two history rows.

Solution:

The current app opens an existing daily entry when a new entry uses the same date, so the driver can edit its totals. It does not automatically merge or delete historical duplicate rows.

## Auth Troubleshooting

### Email not confirmed

Usually means the user was created before Confirm email was turned OFF.

Fix:

1. Supabase -> Authentication -> Users
2. Delete the test user
3. Confirm email is OFF and saved
4. Go back to `http://localhost:3000`
5. Click Create account
6. Then Sign in

### Email rate limit exceeded

Supabase sent too many emails in a short time.

Fix:

1. Stop trying for a while
2. Wait about 1 hour
3. Keep Confirm email OFF for testing
4. Delete the old unconfirmed user
5. Create account again

### Confirmation link opens Supabase dashboard

That means the link is going to the wrong place or is from the template preview.

The template value `{{ .ConfirmationURL }}` is only a placeholder. It works only inside a real email sent by Supabase.

## Localhost Troubleshooting

If `http://localhost:3000` does not open:

1. The local server may have stopped.
2. Restart `server.js`.
3. Refresh the browser.

Common reasons it stops:

- Laptop restarted
- Computer slept
- Codex/terminal session closed
- Local server process ended
- Port `3000` was occupied

## Current MVP Decisions

- Keep app simple and driver-friendly.
- Only Uber and Lyft are shown in daily income for now.
- Insurance and other non-daily costs are entered in the expense form, not daily entry.
- Actual payments and Spread over coverage provide separate ways to report expenses.
- Every payment is recorded separately; future recurring payments are not created automatically.
- In Actual payments mode, an expense counts when its payment date is inside the selected report period.
- Clear data requires typing `DELETE` to avoid accidental deletion.
- CSV export is available for backup and tax review.

## Future Plan

Recommended next steps:

1. Continue testing the Vercel live app.
2. Confirm Supabase login and cloud sync work from the live Vercel URL.
3. Add a custom domain later, for example `driverledger.ca`.
4. Improve reports and expense categories based on real driver usage.
5. Later consider mobile app packaging for Apple App Store and Google Play.

GitHub stores the code. Vercel hosts the website. Supabase stores the data.
