# Krysti’s medicine tracker

GitHub Pages hosts the interface; Supabase provides login and a shared medicine log for both phones. No Tailscale or always-on computer is needed in Supabase mode.

## 1. Create your Supabase project and login

1. Create a Free project at https://supabase.com/dashboard. Save its database password; this is separate from the app login password.
2. In SQL Editor, run all of [supabase/setup.sql](./supabase/setup.sql) once. It creates tables, validation constraints, and row-level security. Do not rerun against an existing installation.
3. Under Authentication → Sign In / Providers, keep email/password enabled and disable **Allow new users to sign up**. Labels may vary.
4. Under Authentication → Users → Add user → Create new user, create an email/password user and enable **Auto Confirm User**.
5. Copy that user's UUID and authorize it in SQL Editor:

```sql
insert into public.tracker_members (user_id)
values ('PASTE-USER-UUID-HERE')
on conflict do nothing;
```

Both phones can use this login. Or create two accounts and authorize both UUIDs; members share one tracker. Remove a membership row to revoke access. The app cannot grant membership. Anonymous users and signed-in nonmembers cannot read or change the log. Keep row-level security enabled.

## 2. Configure the app

Find the project URL and publishable key in the Connect dialog or Settings → API Keys. Edit [public/config.js](./public/config.js):

```js
export const config = {
  mode: 'supabase',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabasePublishableKey: 'sb_publishable_YOUR_KEY',
};
```

These public connection settings may be committed. A legacy anon key also works. **Never publish an sb*secret* key, service_role key, database password, or login password.** Login and database policies protect data, not secrecy of the publishable key. Use the standard supabase.co project URL. Missing settings show a setup message; cloud mode never falls back to a separate local log.

## 3. Run and verify locally

Install Node.js 22 or newer:

```sh
npm start
```

Open http://127.0.0.1:3000. No dependency installation/build is needed. The browser loads a pinned Supabase SDK from jsDelivr; internet access is required. Restart the server after changing server code.

1. Sign in and set the actual recovery day-1 date.
2. Add a clearly labeled test dose. Sign in from another browser/private window and verify it appears there. Remove the test dose afterward.
3. Sign out and verify history disappears. A user not in tracker_members must fail to load the log.

The app refreshes every 15 seconds while visible. Returning to the tab refreshes only if the last successful sync is at least 15 seconds old, without clearing the displayed log. Browser storage remembers login tokens, not a separate medicine log. Sign out on shared devices. There are no offline writes. If a save has an uncertain outcome, check history before retrying. Saves insert/delete individual records rather than replacing another phone's entire log.

## 4. Deploy to GitHub Pages

1. Push the repository and configured public settings to GitHub. Do not commit dose exports or local data.
2. Repository Settings → Pages → Source: choose GitHub Actions.
3. Actions → Deploy medicine tracker to Pages → Run workflow on your branch.
4. Open the successful deployment URL on both phones and sign in. Add it to the home screen as a browser shortcut if desired.
5. Set Supabase Authentication → URL Configuration → Site URL to the full Pages URL including the repository path. Password login needs no redirect, but this sets the destination for future email flows.

The workflow builds [public](./public) into versioned assets in the ignored dist directory and publishes that output; the Node server is not deployed. The interface and medication definitions are public; dose history requires authorized login. Configuration changes require redeployment. This scaffold does not automatically create a Supabase project or deploy the site.

## Troubleshooting and maintenance

- Setup message: complete both config values and reload/redeploy.
- Invalid credentials/email unconfirmed: check the login and confirmed status under Authentication → Users.
- Cannot load shared log: check SQL setup, membership UUID, connectivity, and that the project is active. Nonmembers intentionally get an error.
- SDK download failure: allow jsDelivr in content blockers. The local server security policy allows the SDK and Supabase.
- Forgotten password: no password-reset UI is implemented. Use Supabase dashboard/admin user management to recover or replace the account, then authorize the replacement UUID. Never put admin credentials in the browser.
- Backups: Export JSON downloads all accessible history, including paginated records. Keep backups private. Import/restore is not implemented.
- Existing logs: browser/local-server records are not automatically migrated. Export from the old mode first, keep the backup, and manually enter relevant doses with original timestamps if needed.
- Free plan: projects can pause after a week of inactivity and automatic backups are not included. See [current pricing](https://supabase.com/pricing).

## Optional local modes

Set mode in [public/config.js](./public/config.js) to local-server for the original shared Node JSON log, or browser for separate localStorage logs. These modes have no Supabase login. Local-server mode needs npm start and private access such as Tailscale for remote phones; it cannot run on Pages. The server binds to loopback. Do not expose its unauthenticated API publicly. Its data directory is ignored by Git; run only one server per data directory.

## Medication behavior

[medicine.js](./public/medicine.js) transcribes your supplied instructions, not a medically validated regimen.

| Medicine   | Instructions                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Oxycodone  | 1–2 tablets (5–10 mg) every 4 hours to start; wean as able; 1–2 weeks. Call weekdays during business hours if more is needed. |
| Ibuprofen  | 800 mg every 6 hours, first 3 days only; stagger with Tylenol.                                                                |
| Tylenol    | 500 mg every 6 hours, first 3 days only; stagger with ibuprofen.                                                              |
| Gabapentin | 300 mg at night, first 3 nights only.                                                                                         |
| Aspirin    | 325 mg once daily; no duration supplied.                                                                                      |
| Zofran     | 4 mg every 8 hours as needed for nausea.                                                                                      |

Recovery uses calendar days in the viewing phone's timezone; use matching timezones. The first three nights are represented by the first three calendar days. Daily/nightly medicines show the last dose without assuming a clock time. Interval labels are not clearance to take medicine. No automatic staggering, interaction checks, daily-limit calculations, or background notifications are included.

## Development checks

```sh
npm test
npm run check
```

Automated checks do not replace the live two-browser and database access checks above. No Supabase credentials are bundled.

References: [Password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Updating an existing Supabase project: supplements

Before deploying the version with Calcium, Vitamin C, and Vitamin D, run [001_add_supplements.sql](./supabase/migrations/001_add_supplements.sql) in Supabase SQL Editor. It expands the allowed medicines without removing history or changing access rules. Do not rerun the full setup script on an existing project. New projects using the current setup script already include the supplements.

All three supplements are once daily with **Dosage unknown**; no strength or pill count is assumed. They appear in dose logging, daily-dose warnings, history filters, and exports.

The dose-time shortcuts highlight the selected option. Now is selected when the form opens. Manually editing the date or time clears the shortcut selection. Shortcuts set the displayed timestamp when clicked; that timestamp stays fixed until changed.

## Updating an existing Supabase project: MiraLAX

Run [002_add_miralax.sql](./supabase/migrations/002_add_miralax.sql) in SQL Editor after migration 001, before deploying. New projects using the current setup script need neither migration. Apply migrations in order; do not rerun older migrations after newer ones.


## Deploying updates and avoiding stale assets

Push changes, then start a new **Run workflow** on main. **Re-run jobs** uses the original run's commit. The workflow now tests and builds the app before deploying; each build gives all JavaScript modules and styles a shared content-versioned URL so browsers do not mix old medication definitions with new interface code. After the first deployment with this change, reload the page (hard-refresh once if the old HTML is cached).

Repeated auth events for the same user keep the current log and open forms intact. Only sign-out or a different account clears them. Settings and the first history page are fetched concurrently. Network latency or an inactive Supabase project can still affect the first load.

## Updating an existing Supabase project: lower ibuprofen doses

Run all of [003_add_ibuprofen_doses.sql](./supabase/migrations/003_add_ibuprofen_doses.sql) in Supabase SQL Editor after migration 002. It allows 800 mg, 600 mg, 400 mg, and 200 mg while preserving existing history and every other medicine's allowed doses. The constraint replacement is transactional. Do not rerun older migrations afterward, as they restore older dose restrictions. New projects using the current setup script already support these doses.

## Oxycodone rolling tablet log

The oxycodone card counts tablets logged within the past four hours, using 1 tablet for 5 mg and 2 tablets for 10 mg. It shows the unused portion of a two-tablet tracking window and when one or two slots become available as older records leave the window. A record leaves exactly four hours after its timestamp. For example, one tablet at 8 AM and another at 10 AM leaves zero slots until noon, one at noon, and two at 2 PM, assuming no further doses. Counts never become negative; exceeding two tablets is flagged. Invalid/future records or unknown amounts prevent availability calculation.

This is log arithmetic, not authorization to take medication. The original “1–2 tablets every 4 hours” instructions do not establish a split-dose rolling schedule; confirm that interpretation with the pharmacist or surgical team. The calculation depends on all actual doses being recorded. No database migration is required.

## Daily history and ongoing interval tracking

History displays one local calendar day at a time, starting with the newest day containing records. Use Older/Newer or the date selector to browse days. Filtering a medicine starts at its newest recorded day; background refreshes preserve the selected day. Export JSON still includes the full log, and medication timing still uses all records.

Tylenol and ibuprofen continue displaying six-hour intervals after recovery day 3, per the requested tracking change. Their original discharge instructions remain visible in the dose form; the display change does not establish a new prescribed course duration. Gabapentin retains its three-night cutoff. No database migration is required.
