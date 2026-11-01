# Expenses tracker

An expenses tracker where you log expenses by category, set monthly budgets and fixed costs, and move between months. The same page runs in two ways:

- **Local:** a Mac app (or `python3 server/main.py`) that saves each month as a JSON file on your disk. For one person.
- **Cloudflare:** a website protected by a login, where everyone in a household sees the same months and every change appears live on the others' screens. For sharing.

## Run it locally

**Mac app:** build it once with `mac/build.sh`, then open **Expenses** from `~/Applications`. The app starts the server, shows the page in its own window, and stops the server when you quit.

**Browser:** run `python3 server/main.py`. It opens http://127.0.0.1:8765. Press Ctrl+C to stop.

The local server listens on 127.0.0.1 only, so other machines can't reach it. It needs Python 3 and nothing else. Months are saved in `data/`, which is in `.gitignore`.

## Deploy to Cloudflare

Cloudflare builds and deploys the Worker from GitHub. Nothing personal is in this repository: who can sign in and which household they belong to are set in the Cloudflare dashboard.

1. **Connect the repository.** In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and choose this repository. Keep the default deploy command, `npx wrangler deploy`. Every push to `main` deploys again.
2. **Turn on the login.** Open the Worker's **Access** tab (or **Settings → Domains & Routes → Enable Cloudflare Access**). Choose **All traffic**, and for the policy choose **Cloudflare account** to start with only yourself.
3. **Add one secret.** In the Worker, go to **Settings → Variables and Secrets**, click **Add**, choose type **Secret**, and add:

   | Name | Value |
   |---|---|
   | `HOUSEHOLD_MEMBERS` | JSON from each email to a household name, for example `{"you@example.com": "home"}` |

   Use the email you sign in with. The Worker learns who is signed in from Cloudflare Access (`ctx.access`); a request that Access didn't authenticate is refused. If the page ever says the sign-in can't be read, you can also add the optional secrets `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, and the Worker verifies the Access token itself.
4. **Open the site** and sign in. To bring over months from the local app, click **Export** in the local app, then **Import** on the website.

**Adding a household.** In **Zero Trust → Access → Policies**, edit this Worker's policy and add **Include → Emails** with the new people's addresses; they sign in with a one-time code sent to their email and need no Cloudflare account. Then add them to `HOUSEHOLD_MEMBERS` with their own household name, for example `{"you@example.com": "home", "a@example.com": "family-2", "b@example.com": "family-2"}`. People with the same household name share months; different households never see each other's data. The Cloudflare account owner can see all data stored in the account.

**Testing locally with Cloudflare's runtime.** Copy `.dev.vars.example` to `.dev.vars`, run `npm install` and `npm run dev`, then open http://localhost:8787. `.dev.vars` lets you skip the login on localhost only, and it is git-ignored.

### Cost

Everything fits in Cloudflare's free plan. The page files are static assets, which are free and unlimited. Opening the page uses 2 of the 100,000 requests allowed per day: one for the WebSocket and one for the household. Every change after that travels over the open WebSocket, where 20 messages count as one request, and updates sent back to the screens are free. A keepalive message every 50 seconds adds about 3 requests per hour that a page stays open. A busy day, with two people logging 50 expenses and each keeping the page open for 8 hours, uses about 60 requests.

## Project layout

```
web/                      the page (HTML, CSS, JavaScript modules; no build step)
  index.html
  backend.json            "cloud"; the local server answers this path with "local"
  styles/                 one stylesheet per section of the page
  scripts/
    main.js               entry point: creates ExpensesApp
    ExpensesApp.js        controller: turns user actions into changes
    config/               spending categories and list names
    model/
      MonthRecord.js      one month's data and the rules for changing it
      monthChanges.js     every kind of change, checked and applied the same way everywhere
      monthValidation.js  month keys, month shape, which month a new one copies
    services/
      LocalMonthSync.js   local backend: saves the whole month to the Python server
      CloudMonthSync.js   Cloudflare backend: sends changes over a WebSocket, receives live updates
      createMonthSync.js  picks the backend from backend.json
    views/                one class per section of the page
    utils/                money, month-key, id and HTML helpers
worker/                   Cloudflare Worker
  index.js                routing, login check, same-origin check
  accessAuth.js           verifies the Cloudflare Access token
  households.js           email -> household from the HOUSEHOLD_MEMBERS secret
  HouseholdRoom.js        one Durable Object per household: storage and live connections
server/                   local Python standard-library server
mac/                      native macOS app (Swift + WebKit) around the local server
test/                     unit tests: npm test
data/                     your local month files (not in git)
```

## How data flows

1. A user action, such as adding an expense, becomes a change object, for example `{ kind: 'addExpense', expense: {...} }`.
2. `ExpensesApp` applies the change to the `MonthRecord` on screen with `applyMonthChange()` and redraws the views.
3. The backend stores it:
   - **Local:** `LocalMonthSync` saves the whole month 400 ms after the last change.
   - **Cloudflare:** `CloudMonthSync` sends only the change. The household's Durable Object applies it with the same `applyMonthChange()`, saves it, and sends the updated month to every screen showing that month.

A Durable Object handles one message at a time, so two people editing at once never overwrite each other. A change that isn't confirmed yet stays pending and is re-applied on top of any update from someone else, then resent after a lost connection. Expense ids are created on the device, so a resent expense is only added once.

## Data

- On start, the app opens the current month and creates it if it doesn't exist.
- A new month copies the budgets, expected income, fixed costs and subscriptions from the closest earlier month. If no month exists yet, it starts from zero.
- Use **‹ ›** to move between saved months and **+** to add any month.
- **Export** downloads every month as one JSON file; **Import** loads such a file and replaces the months it contains.
