# How the expenses tracker works

November 3, 2026

This document explains the whole app, from the three parts it runs in down to the code that adds one expense. It is for anyone who changes the code, including you a year from now. Read Part I for the map, Part II to follow one click from the screen to storage and back, Part III for the rules that keep the data correct, and Part IV before you add something new. The README covers setup and deployment; this document covers how the code fits together.

Code excerpts are copied from the files they name, with line numbers from the date above. They can drift as the code changes; the file and the symbol name stay the reliable reference.

---

## Part I. The map

### Chapter 1. Three parts, one contract

The app is a website. It has three parts, and each lives in its own folder:

| Folder    | Runs in     | Job                                                                       |
| --------- | ----------- | ------------------------------------------------------------------------- |
| `web/`    | the browser | draws the month and turns clicks into requests                            |
| `worker/` | Cloudflare  | checks who is signed in, stores each household's months, answers requests |
| `shared/` | both        | the month model, the list of endpoints, the live-update messages          |

The page and the Worker talk in two ways. **HTTP endpoints** carry every edit and every read: one endpoint per operation, such as `POST /api/months/2026-11/expenses` to add an expense. **One WebSocket** per open page carries live updates: when anyone saves an edit, the Worker sends the new month to every page showing that month.

The contract between the two sides is code in `shared/`, not documentation. `shared/api/endpoints.ts` lists every endpoint with its method, path and request body. Both sides import that list, so they can't disagree about what an endpoint expects. TypeScript checks the types while you write code; zod, a small checking library, checks the real data when a request arrives.

Each household has its own **Durable Object**: a small Cloudflare server with its own storage that handles one request at a time. Two people editing at the same moment are therefore applied one after the other, and neither overwrites the other.

### Chapter 2. Layers

Inside each part, the code is split into layers. A layer may use the layers below it, never the ones above. This is what makes a click easy to trace: each step of the path is in a known folder, and the next step is always one layer down.

**The page (`web/scripts/`)**, top to bottom:

| Layer     | Folder             | What it does                                                        |
| --------- | ------------------ | ------------------------------------------------------------------- |
| entry     | `main.ts`          | loads the translations, starts the month page                       |
| page      | `pages/`           | loads a month, draws it with every feature, draws again on changes  |
| feature   | `features/<name>/` | one part of the screen: handles its clicks, calls its API functions |
| component | `components/`      | pieces several features share: entry rows, inline editors           |
| API       | `api/`             | one function per endpoint, the outbox, live updates                 |
| helpers   | `i18n/`, `utils/`  | translations, money formatting, month keys, HTML escaping           |

**The Worker (`worker/`)**, top to bottom:

| Layer                   | File                                                        | What it does                                                          |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| entry                   | `index.ts`                                                  | routes by path, checks the sign-in and where the request came from    |
| household room          | `household/household-room.ts`                               | the Durable Object: HTTP to the router, WebSockets to the broadcaster |
| router                  | `household/router.ts`                                       | finds the endpoint, checks the request, calls the handler             |
| handlers                | `household/handlers/`                                       | one handler per endpoint                                              |
| household               | `household/household.ts`                                    | `editMonth()`: the steps every edit follows                           |
| repository, broadcaster | `household/month-repository.ts`, `household/broadcaster.ts` | storage, and sending live updates                                     |

**Shared (`shared/`)** sits under both. It may import nothing from `web/` or `worker/`, and no package except zod. Its own `tsconfig.json` has no browser and no Cloudflare types, so code that touches either fails to compile there.

Two more rules hold the layers apart. A feature may not import another feature, so each part of the screen can be read alone. And nothing imports upward: an API function never calls a feature, and a handler never calls the router.

These rules are not a convention you have to remember. `eslint/layers.mjs` is an ESLint rule that lists every layer and what it may import, and `npm run check` fails when an import breaks it. The error names the layer and what it may import instead:

```
features/backup may not import features/categories (../categories/category-cards.ts).
features/backup may import: api, components, i18n, utils, shared. See ARCHITECTURE.md.
```

> **Sidebar: why not React?** A framework would add its own layer of concepts (components, hooks, state) on top of these. The app has one page and nine features, each a small class with a `render(month)` method. Plain modules keep the path from click to request visible in the code itself.

---

## Part II. Following one click

This part follows a single action through every layer: you type 4 into the "Add expense" bar, choose Lunch, and press Add. Chapter 3 covers the page, Chapter 4 the Worker, and Chapter 5 the trip back.

### Chapter 3. On the page

**Step 1. The feature handles the click.** Each feature listens for its own events. The quick add bar listens for its form's submit event.

Listing 3-1. The quick add bar sends the expense. Excerpt from `web/scripts/features/quick-add/quick-add.ts`, lines 25–38.

```ts
this.#form.addEventListener('submit', (submitEvent) => {
  submitEvent.preventDefault();
  if (!this.#month) return;
  const isSent = expensesApi.addExpense(this.#month.monthKey, {
    categoryId: this.#categorySelect.value,
    amount: parseAmount(this.#amountInput.value) ?? 0,
    description: this.#descriptionInput.value,
    date: this.#dateInput.value || defaultExpenseDate(this.#month.monthKey),
  });
  if (!isSent) return; // for example no amount: keep what was typed
  this.#amountInput.value = '';
  this.#descriptionInput.value = '';
  this.#amountInput.focus();
});
```

The feature knows the month on screen because the page called its `render(month)` last time. It reads the form fields and calls one API function. It never builds a request or changes the month itself. The category card's add form calls the same `addExpense()`, so both ways of adding an expense take the same path from here on.

**Step 2. The API function names the endpoint.** Each function in `api/*-api.ts` matches one endpoint.

Listing 3-2. One API function per endpoint. Excerpt from `web/scripts/api/expenses-api.ts`, lines 19–21.

```ts
export function addExpense(monthKey: string, expense: NewExpense): boolean {
  return outbox.send('addExpense', { month: monthKey }, { id: createUniqueId(), ...expense });
}
```

The function gives the expense its id here, on the device. Chapter 6 explains why the id can't wait for the server.

**Step 3. The outbox queues and sends.** Every edit goes through the outbox in `api/outbox.ts`. It checks the request against the endpoint, keeps it in a list that is also saved in the browser's localStorage, and starts sending.

Listing 3-3. The outbox accepts an edit. Excerpt from `web/scripts/api/outbox.ts`, lines 48–55.

```ts
send<Name extends EndpointName>(name: Name, params: ParamsOf<Name>, body: BodyInputOf<Name>): boolean {
  if (!isValidBody(name, body)) return false;
  this.#edits.push({ name, params, body });
  saveEdits(this.#edits);
  this.onEditsChange();
  void this.#sendWaitingEdits();
  return true;
}
```

`isValidBody` uses the same zod schema the Worker uses, so an amount of 0 is refused here, before any request. `onEditsChange` asks the page to draw again, which is how the expense appears on screen at once (step 4). `#sendWaitingEdits` then sends the waiting edits one at a time, oldest first, through `callEndpoint` in `api/http.ts`, which makes the HTTP request: `POST /api/months/2026-11/expenses` with the expense as JSON.

**Step 4. The page draws the edit before the server answers.** The page never changes its copy of the month directly. It always draws the server's last version with the outbox's waiting edits applied on top.

Listing 3-4. The month to show. Excerpt from `web/scripts/api/waiting-edits.ts`, lines 26–39.

```ts
export function monthWithWaitingEdits(serverMonth: MonthData, edits: readonly WaitingEdit[]): MonthRecord {
  const month = new MonthRecord(serverMonth);
  for (const edit of edits) {
    if (edit.params.month !== month.monthKey || !isMonthEdit(edit.name)) continue;
    const request = checkedRequest(edit.name, edit);
    if (!request) continue;
    try {
      applyMonthEdit(month, edit.name, request);
    } catch (error) {
      if (!(error instanceof MonthRuleError)) throw error;
    }
  }
  return month;
}
```

The function starts from a fresh copy of the server's month, then applies each waiting edit for that month in order. `applyMonthEdit` is the same function the Worker runs (Chapter 4, step 4), so the page's early version matches what the server will answer. An edit that breaks a rule, for example because someone else removed its category, is skipped here; the server refuses it too.

### Chapter 4. In the Worker

**Step 1. The entry point checks who is asking.** `worker/index.ts` sends paths under `/api/months/`, `/api/export` and `/api/import` to `callHouseholdEndpoint`.

Listing 4-1. Where the request came from, and who sent it. Excerpt from `worker/index.ts`, lines 59–83.

```ts
async function callHouseholdEndpoint(request: Request, env: Env, context: Context): Promise<Response> {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  const isFromAnotherSite = fetchSite !== null && fetchSite !== 'same-origin' && fetchSite !== 'none';
  if (isFromAnotherSite || (request.method !== 'GET' && !isSameOriginRequest(request))) {
    return textResponse('Forbidden', 403);
  }
  return forwardToHousehold(request, env, context);
}

async function forwardToHousehold(request: Request, env: Env, context: Context): Promise<Response> {
  let householdName: string;
  try {
    const email = await verifiedUserEmail(request, env, context);
    householdName = householdForEmail(email, env);
  } catch (error) {
    // ... a failed sign-in or an unknown email answers 403
  }
  const household = env.HOUSEHOLD.get(env.HOUSEHOLD.idFromName(householdName));
  return household.fetch(request);
}
```

The first function refuses requests that another website started (Chapter 8). The second asks Cloudflare Access who is signed in (`access-auth.ts`) and looks up their household in the `HOUSEHOLD_MEMBERS` secret (`households.ts`). It then passes the request to that household's Durable Object. The household name becomes the Durable Object's id, so the same household always reaches the same object and its storage.

**Step 2. The household room hands HTTP requests to the router.**

Listing 4-2. The Durable Object's front door. Excerpt from `worker/household/household-room.ts`, lines 32–37.

```ts
override async fetch(request: Request): Promise<Response> {
  if (request.headers.get('Upgrade') !== 'websocket') return routeRequest(request, this.#household);
  const { 0: deviceSocket, 1: serverSocket } = new WebSocketPair();
  this.#household.broadcaster.accept(serverSocket);
  return new Response(null, { status: 101, webSocket: deviceSocket });
}
```

An ordinary request goes to the router. A WebSocket request becomes a live connection, which the broadcaster keeps (Chapter 5).

**Step 3. The router finds the endpoint and checks the request.**

Listing 4-3. From request to handler. Excerpt from `worker/household/router.ts`, lines 20–56, shortened, with notes added.

```ts
export async function routeRequest(request: Request, household: Household): Promise<Response> {
  const { pathname } = new URL(request.url);
  for (const name of Object.keys(endpoints) as EndpointName[]) {
    const endpoint = endpoints[name];
    if (endpoint.method !== request.method) continue;
    const rawParams = matchPath(endpoint.path, pathname);
    if (rawParams) return runEndpoint(name, rawParams, request, household);
  }
  return errorResponse(404, { error: 'Not found' });
}

// in runEndpoint:
const params = endpoint.params.safeParse(rawParams); // 400 when the path is wrong
const body = endpoint.body.safeParse(rawBody); // 400 when the body is wrong
const result = await handler({ params: params.data, body: body.data }, household);
return jsonResponse(200, result);
// MonthRuleError -> 409 with the rule that was broken
```

The router walks the same endpoint table the page used. Our request matches `addExpense`, whose entry is in Listing 4-4. The router checks the path parameters and the body against the entry's zod schemas. After that, the handler receives typed values in range and never checks shapes itself.

Listing 4-4. The addExpense entry in the endpoint table. Excerpt from `shared/api/endpoints.ts`, lines 65–70.

```ts
addExpense: endpoint(
  'POST',
  '/api/months/:month/expenses',
  InMonth,
  z.object({ id: Id, categoryId: Id, amount: PositiveAmount, description: OptionalText, date: IsoDate }),
),
```

`InMonth` says the path has one parameter, `month`, in the form `YYYY-MM`. The field shapes (`Id`, `PositiveAmount` and so on) live in `shared/api/fields.ts`, so every endpoint uses the same limits: ids up to 64 characters, amounts up to 10 million, text up to 200 characters.

**Step 4. The handler runs the edit.** Every editing endpoint has the same handler shape, built by `monthEditHandler` in `handlers/month-edit.ts`. It calls `editMonth`, which holds the four steps of every edit.

Listing 4-5. The steps of every edit. Excerpt from `worker/household/household.ts`, lines 26–37.

```ts
export async function editMonth(
  household: Household,
  monthKey: string,
  change: (month: MonthRecord) => void,
): Promise<MonthResponse> {
  const month = await household.months.loadOrCreate(monthKey);
  change(month);
  await household.months.save(month);
  const response = await monthResponse(household, month);
  household.broadcaster.sendMonth(response);
  return response;
}
```

1. **Load.** The repository reads the month from storage, or creates it from the closest saved month if it doesn't exist yet.
2. **Change.** `change` is the endpoint's edit function from `shared/api/month-edits.ts` (Listing 4-6).
3. **Save.** The repository writes the month and raises the household's revision number by one (Chapter 5).
4. **Broadcast.** The broadcaster sends the new month to every device showing it. The same month is the answer to the request.

Listing 4-6. What each edit does to the month. Excerpt from `shared/api/month-edits.ts`, lines 23–26.

```ts
export const monthEdits: { [Name in MonthEditName]: (month: MonthRecord, request: MonthEditRequest<Name>) => void } = {
  addExpense: (month, { body }) => month.addExpense(body),
  changeExpenseAmount: (month, { params, body }) => month.updateExpenseAmount(params.id, body.amount),
  removeExpense: (month, { params }) => month.removeExpense(params.id),
  // ... one line per editing endpoint
```

This table is the one place that says what each endpoint does to a month. The Worker runs it on the stored month; the page runs it on its copy for waiting edits (Listing 3-4).

**Step 5. The model enforces the month's rules.** `MonthRecord` in `shared/month/month-record.ts` is the only code that changes month data.

Listing 4-7. Adding an expense. Excerpt from `shared/month/month-record.ts`, lines 184–207, shortened, with notes added.

```ts
addExpense({ id, categoryId, amount, description, date }: { ... }): void {
  if (!(amount > 0) || this.findExpense(id)) return;
  this.#requireCategory(categoryId);   // MonthRuleError('unknown-category')
  this.#requireDateInMonth(date);      // MonthRuleError('date-outside-month')
  this.expenses.push({ id, date, category: categoryId, description: description.trim(), amount: roundToCents(amount) });
}
```

The zod schemas check what can be checked without the month: types, lengths, formats. The model checks what needs the month: does Lunch exist in November, is the date in November. A broken rule throws `MonthRuleError` with the rule's name, which the router turns into a 409 answer. Because nothing was saved yet, a refused edit leaves storage untouched.

> **Sidebar: two kinds of checks.** A request is checked twice, for different things. The endpoint's zod schema answers "is this a well-formed expense?" (400 when not). The model answers "does this expense fit this month?" (409 when not). Keep that split when you add an endpoint: shape rules in `fields.ts` and `endpoints.ts`, month rules in `MonthRecord`.

### Chapter 5. The way back

The handler's answer travels back to the outbox, and the outbox gives it to the month page.

Listing 5-1. The page shows a month from the server. Excerpt from `web/scripts/pages/month-page.ts`, lines 123–138.

```ts
#show(answer: MonthResponse): void {
  if (answer.month.month !== this.#shownMonthKey || answer.revision < this.#shownRevision) return;
  this.#shownRevision = answer.revision;
  this.#serverMonth = answer.month;
  this.#savedMonthKeys = answer.monthKeys;
  this.#statusBar.showError(null);
  this.#render();
}

#render(): void {
  if (!this.#serverMonth) return;
  const month = monthWithWaitingEdits(this.#serverMonth, outbox.waitingEdits);
  this.#monthNavigation.render(month.monthKey, this.#savedMonthKeys);
  for (const feature of this.#features) feature.render(month);
}
```

The outbox has already dropped the answered edit, so `#render` now draws the server's month with only the edits still waiting. On screen nothing moves: the expense was already shown, and now it is the server's copy.

Three kinds of message reach `#show`: the answer to an edit, the answer to opening a month (`GET /api/months/:month`), and a live update from the WebSocket. They can arrive in any order. Every answer carries a **revision**, a number the household raises by one with every save. The page ignores anything older than what it shows, so a late answer can't replace a newer month.

The other devices get the month through their WebSocket. Each page tells its household which month it shows (the `watchMonth` message in `shared/protocol.ts`). After every save, `broadcaster.ts` sends the month to the sockets watching it. On those pages, `api/live-updates.ts` passes the month to the same `#show`.

> **Sidebar: the WebSocket costs almost nothing.** Cloudflare answers the keepalive ping without waking the Durable Object, and messages sent to a device are free. The socket stays open while the Durable Object sleeps between requests.

---

## Part III. What keeps the data correct

### Chapter 6. Every edit is safe to send twice

A request can reach the server while its answer is lost, for example when a phone goes through a tunnel. The outbox then sends it again. Every edit is written so that a second copy changes nothing:

- New items carry an id made on the device (Listing 3-2). Adding an id that already exists does nothing, so a resent expense is added once.
- Edits name items by id, never by position, so they still hit the right row after someone else added or removed others.
- Setting a value (an amount, a name, a position) twice gives the same result as once. Removing something already gone does nothing.

This is why the outbox needs no request ids and the server keeps no list of handled requests.

### Chapter 7. Offline

Without a connection, `callEndpoint` throws `OfflineError`. The outbox keeps the edit, sets its state to offline (the status shows "Offline, reconnecting…"), and tries again every 5 seconds, when the browser reports it is online, and when the live connection comes back. The waiting edits are in localStorage too, so they survive a closed tab and go out the next time the page opens.

Meanwhile the screen shows every waiting edit (Listing 3-4). The outbox sends edits one at a time, in order, so a later edit never reaches the server before an earlier one.

When the server refuses an edit for good (a 400 or 409 answer), the outbox drops it, the status shows "Not saved", and the page loads the month again to show the server's version.

> **Sidebar: a refused offline edit.** You remove the Gifts category on the train; meanwhile your sister adds a gift expense at home. Your phone shows Gifts gone until it reconnects. Then the server refuses the removal (409, `category-has-expenses`), and Gifts comes back on your screen with her expense in it. The data stays correct; your edit is the one that loses.

### Chapter 8. Who may call what

Cloudflare Access sits in front of the whole site and asks for a sign-in. Behind it, the Worker checks three things on every endpoint call (Listing 4-1):

1. **The sign-in.** `access-auth.ts` gets the email from Cloudflare Access. Without a verified email, the answer is 403.
2. **The household.** `households.ts` maps the email to a household through the `HOUSEHOLD_MEMBERS` secret. Each household has its own Durable Object, so one household can't reach another's months.
3. **The origin.** A browser sends the sign-in cookie with requests that other websites start too. The Worker refuses any request the browser marks as coming from another site, and any edit without this site's own Origin header.

For local testing, `ACCESS_TEST_BYPASS_EMAIL` in `.dev.vars` replaces the sign-in. It works only when the host is `localhost` or `127.0.0.1`, so it can't open the real site.

---

## Part IV. Changing the app

### Chapter 9. Adding an endpoint

Suppose you want to rename an expense. Each step below is in a different layer, and TypeScript or the tests point out a missing step.

1. **Model.** Add `renameExpense(expenseId, newName)` to `MonthRecord` in `shared/month/month-record.ts`. Throw `MonthRuleError` for a broken month rule, and add the rule's name to `MonthRule`.
2. **Endpoint.** Add `renameExpense` to `endpoints` in `shared/api/endpoints.ts`, for example `PUT /api/months/:month/expenses/:id/description` with `ItemInMonth` and a body of `z.object({ description: Text })`.
3. **Edit.** Add one line to `monthEdits` in `shared/api/month-edits.ts`. TypeScript fails until you do, because the table must cover every editing endpoint.
4. **Handler.** Add `renameExpense: monthEditHandler('renameExpense')` to `worker/household/handlers/index.ts`. TypeScript fails until you do here too.
5. **API function.** Add `renameExpense()` to `web/scripts/api/expenses-api.ts`; it calls `outbox.send('renameExpense', ...)`.
6. **Feature.** Call it from the feature that shows the expense, for example `features/categories/category-cards.ts`.
7. **Tests.** Add a model test in `test/monthRecord.test.mjs` and an endpoint call in `test/household.test.mjs`. `test/endpoints.test.mjs` already checks that no two endpoints match the same request.

An endpoint that only reads (like `getMonth`) skips steps 1 and 3: it gets its own handler in `handlers/months.ts` and its API function calls `callEndpoint` directly instead of the outbox.

### Chapter 10. Adding a part of the screen

1. Add the markup to `web/index.html`, with `data-i18n` attributes for its text.
2. Create `web/scripts/features/<name>/<name>.ts` with a class that has a `render(month: MonthRecord)` method. It reads its elements with `getElement`, listens for its own events, and calls API functions.
3. Add it to the `#features` list in `pages/month-page.ts`.
4. Add its text to both `web/i18n/en.json` and `web/i18n/el.json`. `npm test` fails when an id is missing from either.

### Chapter 11. Checking a change

- `npm run check` runs Prettier, ESLint (including the layer rule), the type checker and the unit tests.
- `npm run dev` and `npm run seed` run the real Worker on your computer with made-up months; see "Try changes locally" in the README.
- `curl` reaches any endpoint while `npm run dev` runs; an edit needs `-H "Origin: http://localhost:8787"`.

---

## Appendix A. Files

| File                                            | Layer          | What it holds                                                                           |
| ----------------------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `shared/month/month-record.ts`                  | shared         | `MonthRecord`: one month's data and its rules; `MonthRuleError`                         |
| `shared/month/categories.ts`                    | shared         | default categories, colours, limits                                                     |
| `shared/month/month-validation.ts`              | shared         | month keys, the basic shape of a month file, which month a new one copies               |
| `shared/month/amounts.ts`                       | shared         | rounding to cents, sums                                                                 |
| `shared/api/endpoints.ts`                       | shared         | every endpoint: method, path, params, body; response types                              |
| `shared/api/fields.ts`                          | shared         | shapes of ids, amounts, text, dates                                                     |
| `shared/api/month-edits.ts`                     | shared         | what each editing endpoint does to a month                                              |
| `shared/protocol.ts`                            | shared         | the two WebSocket messages: `watchMonth` and `month`                                    |
| `web/scripts/main.ts`                           | entry          | loads translations, starts the month page                                               |
| `web/scripts/pages/month-page.ts`               | page           | loads, shows and redraws the month; save status                                         |
| `web/scripts/features/*/`                       | feature        | one folder per part of the screen                                                       |
| `web/scripts/components/`                       | component      | entry rows, inline number and text editors                                              |
| `web/scripts/api/*-api.ts`                      | API            | one function per endpoint                                                               |
| `web/scripts/api/http.ts`                       | API            | `callEndpoint`: one HTTP request; `ApiError`, `OfflineError`                            |
| `web/scripts/api/outbox.ts`                     | API            | sends edits in order; keeps them while offline                                          |
| `web/scripts/api/waiting-edits.ts`              | API            | the server's month with waiting edits on top                                            |
| `web/scripts/api/live-updates.ts`               | API            | the WebSocket for other people's edits                                                  |
| `worker/index.ts`                               | Worker entry   | routing, sign-in, origin check                                                          |
| `worker/access-auth.ts`, `worker/households.ts` | Worker entry   | who is signed in; which household they belong to                                        |
| `worker/household/household-room.ts`            | household room | the Durable Object                                                                      |
| `worker/household/router.ts`                    | router         | request to handler, errors to status codes                                              |
| `worker/household/handlers/`                    | handlers       | `months.ts` (get, export, import), `month-edit.ts` (every edit), `index.ts` (the table) |
| `worker/household/household.ts`                 | household      | `editMonth`, `monthResponse`                                                            |
| `worker/household/month-repository.ts`          | repository     | months and the revision in Durable Object storage                                       |
| `worker/household/broadcaster.ts`               | broadcaster    | which device shows which month; sending updates                                         |
| `eslint/layers.mjs`                             | tooling        | the layer rule                                                                          |

## Appendix B. Glossary

- **Durable Object.** A Cloudflare server instance with its own storage. This app runs one per household and gives it the household's name as its id.
- **Endpoint.** One HTTP method and path that does one thing, listed in `shared/api/endpoints.ts`.
- **Handler.** The Worker function that answers one endpoint.
- **Month key.** A month as `YYYY-MM`, for example `2026-11`. Keys sort by date as plain text.
- **Outbox.** The page's list of edits not yet answered by the server.
- **Revision.** A number the household raises by one with every save; the page uses it to ignore older answers.
- **Waiting edit.** An edit in the outbox. The page shows it on top of the server's month.
- **zod.** A library that describes the shape of data and checks real data against it. The app uses its smaller form, `zod/mini`, to keep the page small.
