# Vehicle Maintenance update — November 11, 2026

## Install

1. Back up existing financial records with Export CSV.
2. In the existing Supabase project, run the entire `upgrade-20261111-maintenance.sql` in SQL Editor. It adds one private, account-scoped table and does not modify financial records.
3. Upload and commit `app.js`, `index.html`, and `styles.css` together in GitHub. Keep the Vercel configuration.
4. Wait for Vercel Ready, refresh, and scroll to Vehicle Maintenance.
5. Add a vehicle, then a service. Check Saved to cloud and refresh to verify persistence. Verify a second account cannot see these records.

## Use

- Enter a distinct vehicle name including year, make/model and plate or nickname. Use Edit next to the vehicle to update its current odometer and reading date. Daily driving entries are not associated with a vehicle, so they do not silently update this reading.
- Record each completed service separately, including engine oil and oil filter. Use the same visit reference, date and odometer to identify the same visit.
- For a bundled invoice, allocate its total once across the service records (for example oil $90 and filter $0). Add a receipt HTTPS link or a note. File uploads are not included.
- Search a vehicle or service type to see its latest recorded service, distance since, and entered reminder. No record means **Service history unknown**.
- Enter intervals only from guidance for the particular vehicle and driving conditions, with a manual page/source. Both kilometre and month intervals use whichever comes first. A dashboard reminder is displayed as entered; update it after checking the vehicle. There is no manufacturer lookup or automatic dashboard connection.
- Reminders apply to the latest completed service record. Edit that record to correct its guidance. Records represent the driver's confirmation of completed work, not independent verification.
- Service costs are a separate log; they do not automatically affect profit. Record the payment once in Other costs if needed in financial reports. Existing Oil change expenses are not treated as confirmed service history.
- Saves use the existing persistent retry queue. If offline, keep the browser data and retry Sync now. Sign-out hides maintenance records and clears its forms. The financial Clear data action does not delete maintenance history; service deletion requires confirmation.

## Verification

Run the existing report/sync tests and maintenance tests with Node:

```
node tests/report-sync.test.cjs
node tests/maintenance.test.cjs
```

Test the actual deployment after running the SQL: save, refresh, search, edit, delete with confirmation, retry offline changes, sign out, and verify account isolation. The migration must be run before this frontend version loads cloud data.

Local verification: JavaScript syntax and both automated test suites passed. Browser testing could not run because Edge failed to launch in the restricted environment. Supabase migration and live account isolation still require verification after installation.
