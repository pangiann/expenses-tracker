# Expenses tracker

An expenses tracker where you log expenses by category, set monthly budgets and fixed costs, and move between months. It is a website on Cloudflare, protected by a login, where everyone in a household sees the same months and every change appears live on the others' screens.

## Try changes locally

Test on your own computer before you push. You need Node.js.

1. Run `npm install` once, and copy `.dev.vars.example` to `.dev.vars` (git-ignored). It lets you skip the login, on localhost only.
2. Run `npm run dev` and open http://localhost:8787. This runs the real Worker and Durable Object on your computer, with their own storage in `.wrangler/` (git-ignored), separate from the live site.
3. In a second terminal, run `npm run seed` to fill the last six months with made-up expenses, income and fixed costs. Run it again whenever you want fresh data; it replaces those six months.
4. Click around. `wrangler dev` rebuilds the page when you save a file in `web/scripts/`; reload the browser to see it.

## Checks

Run `npm run check` before you push. It runs every check below; each one also has its own command.

- `npm run format:check` checks the layout with Prettier. `npm run format` fixes it.
- `npm run lint` looks for mistakes with ESLint.
- `npm run typecheck` checks the TypeScript code. The page and the Worker each have a `tsconfig.json`, because one runs in a browser and the other on Cloudflare. Existing `.js` files aren't checked until they become `.ts`.
- `npm test` runs the unit tests with vitest. `npm run test:watch` reruns them on every save.

After changing `wrangler.jsonc`, run `npm run types` to regenerate the Worker's types in `worker/worker-configuration.d.ts`.

## Build

The page's JavaScript lives in `web/scripts/` and imports npm packages by name, for example `import Sortable from 'sortablejs'`. `npm run build` uses esbuild to bundle it, together with the packages it imports from `node_modules/`, into `web/dist/main.js`, which `index.html` loads. `web/dist/` is generated and git-ignored.

- `npm run build` builds once; `npm run watch` rebuilds on every save while you work on the page.
- `wrangler deploy` and `wrangler dev` run the build first (`build.command` in `wrangler.jsonc`), so Cloudflare builds on every deploy with no dashboard setting.
- To add a library: `npm install --save-dev <package>`, then import it by name.

## Deploy to Cloudflare

Cloudflare builds and deploys the Worker from GitHub. Nothing personal is in this repository: who can sign in and which household they belong to are set in the Cloudflare dashboard.

1. **Connect the repository.** In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and choose this repository. Keep the default deploy command, `npx wrangler deploy`. Every push to `main` deploys again.
2. **Turn on the login.** Open the Worker's **Access** tab (or **Settings → Domains & Routes → Enable Cloudflare Access**). Choose **All traffic**, and for the policy choose **Cloudflare account** to start with only yourself.
3. **Add one secret.** In the Worker, go to **Settings → Variables and Secrets**, click **Add**, choose type **Secret**, and add:

   | Name                | Value                                                                               |
   | ------------------- | ----------------------------------------------------------------------------------- |
   | `HOUSEHOLD_MEMBERS` | JSON from each email to a household name, for example `{"you@example.com": "home"}` |

   Use the email you sign in with. The Worker learns who is signed in from Cloudflare Access (`ctx.access`); a request that Access didn't authenticate is refused. If the page ever says the sign-in can't be read, you can also add the optional secrets `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, and the Worker verifies the Access token itself.

4. **Open the site** and sign in. To bring over months from a backup file, click **Import**.

**Adding a household.** In **Zero Trust → Access → Policies**, edit this Worker's policy and add **Include → Emails** with the new people's addresses; they sign in with a one-time code sent to their email and need no Cloudflare account. Then add them to `HOUSEHOLD_MEMBERS` with their own household name, for example `{"you@example.com": "home", "a@example.com": "family-2", "b@example.com": "family-2"}`. People with the same household name share months; different households never see each other's data. The Cloudflare account owner can see all data stored in the account.

### Cost

Everything fits in Cloudflare's free plan. The page files are static assets, which are free and unlimited. Opening the page uses 2 of the 100,000 requests allowed per day: one for the WebSocket and one for the household. Every change after that travels over the open WebSocket, where 20 messages count as one request, and updates sent back to the screens are free. A keepalive message every 50 seconds adds about 3 requests per hour that a page stays open. A busy day, with two people logging 50 expenses and each keeping the page open for 8 hours, uses about 60 requests.

## Project layout

```
shared/                   code that runs in the page and in the Worker (no DOM, no Cloudflare)
  month/
    categories.ts         default categories, colours and limits
    amounts.ts            rounding and sums
    month-record.ts       one month's data and the rules for changing it
    month-changes.ts      every kind of change: its shape (checked with zod) and how it applies
    month-validation.ts   month keys, month shape, which month a new one copies
web/                      the page (HTML, CSS, JavaScript modules; bundled into web/dist/ by `npm run build`)
  index.html
  i18n/en.json, el.json   display text for every string id
  styles/                 one stylesheet per section of the page
  scripts/
    main.js               entry point: creates ExpensesApp
    ExpensesApp.js        controller: turns user actions into changes
    i18n/Translator.js    translations by string id (see "Languages" below)
    services/
      CloudMonthSync.js   sends changes over a WebSocket, receives live updates
      PendingChangeStore.js  keeps unconfirmed changes in the browser, so offline edits survive a closed tab
      SaveStatus.js       the states the status pill shows
    views/                one class per section of the page; CategoryDragController reorders cards
    utils/                money, month-key, id and HTML helpers
worker/                   Cloudflare Worker
  index.js                routing, login check, same-origin check
  accessAuth.js           verifies the Cloudflare Access token
  households.js           email -> household from the HOUSEHOLD_MEMBERS secret
  HouseholdRoom.js        one Durable Object per household: storage and live connections
scripts/seed-dev-data.mjs made-up months for the local test site: npm run seed
test/                     unit tests: npm test
```

## How data flows

1. A user action, such as adding an expense, becomes a change object, for example `{ kind: 'addExpense', expense: {...} }`.
2. `ExpensesApp` applies the change to the `MonthRecord` on screen with `applyMonthChange()` and redraws the views.
3. `CloudMonthSync` sends only the change. The household's Durable Object applies it with the same `applyMonthChange()`, saves it, and sends the updated month to every screen showing that month.

A Durable Object handles one message at a time, so two people editing at once never overwrite each other. A change that isn't confirmed yet stays pending and is re-applied on top of any update from someone else, then resent after a lost connection. Expense ids are created on the device, so a resent expense is only added once.

## Languages

The page is in English and Greek; the EN / ΕΛ picker in the top bar switches between them and the choice is remembered. The code contains no display text, only string ids such as `summary.earned`. Each language has one file, `web/i18n/en.json` and `web/i18n/el.json`, that maps every id to its text. In the HTML, elements name their id with `data-i18n` (text), `data-i18n-placeholder`, `data-i18n-title` or `data-i18n-aria-label`; in JavaScript, `t('summary.earned')`. English is the fallback for a missing translation.

To add or change text, edit both files with the same id. `npm test` fails if the files don't have the same ids, if a placeholder like `{amount}` differs, or if the page uses an id that has no text. To add a language, add its file and an entry in `SUPPORTED_LANGUAGES` in `Translator.js`.

## Data

- **Categories** belong to each month. A new household starts with 11 defaults (Dinner/Drinks, Lunch, Supermarket, Transport, Travel, Entertainment, Health & sport, Home, Clothes, Gifts, Other), which show in the page language.
  - **Add** one with the "New category" card at the end of the grid. Names are at most 20 characters and must differ from the month's other names, ignoring capitals.
  - **Rename** one by clicking its name. A renamed default shows the typed name in every language.
  - **Remove** one with the ✕ in its top-right corner, after a confirmation. The ✕ is greyed out, with the reason on hover or tap, while the category has expenses or is the last one.
  - **Reorder** by dragging a card by its header. On a phone, hold the card for a moment first.
  - Every change applies to the month on screen only. A month created later copies the latest earlier month's categories, budgets and order; existing months don't change.
- **Income** is a list of entries, like expenses: a salary, each private lesson, and so on. Earned is their total.
- Every item (expense, income entry, fixed cost, subscription) has an id. Changes name items by id, so two people editing different items never affect each other.
- On start, the app opens the current month and creates it if it doesn't exist.
- A new month copies the budgets, expected income, fixed costs and subscriptions from the closest earlier month. If no month exists yet, it starts from zero.
- Use **‹ ›** to move between saved months and **+** to add any month.
- **Export** downloads every month as one JSON file; **Import** loads such a file and replaces the months it contains.
