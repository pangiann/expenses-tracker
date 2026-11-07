# How the expenses tracker works

November 7, 2026

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

**The page (`web/scripts/`)** is React, written in TypeScript (`.tsx` files). Top to bottom:

| Layer     | Folder             | What it does                                                                             |
| --------- | ------------------ | ---------------------------------------------------------------------------------------- |
| entry     | `main.tsx`         | loads the translations, draws the month page, connects to the server                     |
| page      | `pages/`           | `month-page.tsx` lays out every feature with the page's state                            |
| feature   | `features/<name>/` | one part of the screen, as React components: handles its clicks, calls its API functions |
| component | `components/`      | pieces several features share: entry rows, editable amounts and texts                    |
| API       | `api/`             | one function per endpoint; `endpoint-http-client.ts` makes the HTTP requests             |
| sync      | `sync/`            | the page's state, the outbox of unsaved edits, the optimistic month, the live connection |
| helpers   | `i18n/`, `utils/`  | translations, money formatting, month keys                                               |

**The Worker (`worker/`)**, top to bottom. The files below `worker-entry-point.ts` and `sign-in/` are in `household-durable-object/`:

| Layer                    | File                                                                      | What it does                                                                                        |
| ------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| entry point              | `worker-entry-point.ts`                                                   | every request arrives here: routes by path, checks where it came from and who is signed in          |
| sign-in                  | `sign-in/`                                                                | who is signed in, which household they belong to, whether the request came from the site's own page |
| household Durable Object | `household-durable-object.ts`                                             | one per household: HTTP requests to the router, WebSockets to the connection manager                |
| API request router       | `api-request-router.ts`                                                   | finds the endpoint, checks the request, calls the operation                                         |
| operations               | `operations/`                                                             | one function per endpoint, grouped by what it does: add, change, remove, read, backup               |
| edit steps               | `load-edit-save-and-broadcast-month.ts`                                   | the four steps every edit follows                                                                   |
| operation context        | `operation-context.ts`                                                    | what every operation receives: the month repository and the live-update connections                 |
| storage, live updates    | `durable-object-month-repository.ts`, `live-update-connection-manager.ts` | the household's months, and sending them to open pages                                              |

**Shared (`shared/`)** sits under both. It may import nothing from `web/` or `worker/`, and no package except zod. Its own `tsconfig.json` has no browser and no Cloudflare types, so code that touches either fails to compile there.

Two more rules hold the layers apart. A feature may not import another feature, so each part of the screen can be read alone. And nothing imports upward: an API function never calls a feature, and an operation never calls the router.

These rules are not a convention you have to remember. `eslint/layers.mjs` is an ESLint rule that lists every layer and what it may import, and `npm run check` fails when an import breaks it. The error names the layer and what it may import instead:

```
features/backup may not import features/categories (../categories/category-cards.ts).
features/backup may import: api, http client, components, i18n, utils, shared. See ARCHITECTURE.md.
```

> **Sidebar: what React does here.** A component is a function from data to markup: `QuickAdd({ month })` returns the form for that month. When the month changes, React calls the function again and changes only the parts of the screen that differ. So no code finds elements or writes HTML by hand, text is escaped automatically, and a click handler names what it changes: `onClick={() => removeExpense(expense.id)}`. Everything below React (the API functions, the outbox, the Worker) works the same as without it.

---

## Part II. Following one click

This part follows a single action through every layer: you type 4 into the "Add expense" bar, choose Lunch, and press Add. Chapter 3 covers the page, Chapter 4 the Worker, and Chapter 5 the trip back.

### Chapter 3. On the page

**Step 1. The feature handles the click.** Each feature listens for its own events. The quick add bar listens for its form's submit event.

Listing 3-1. The quick add bar sends the expense. Excerpt from `web/scripts/features/quick-add/quick-add.tsx`, lines 33–45.

```tsx
onSubmit={(submitEvent) => {
  submitEvent.preventDefault();
  const isSent = expensesApi.addExpense(month.monthKey, {
    categoryId,
    amount: parseAmount(amount) ?? 0,
    description,
    date: date || defaultExpenseDate(month.monthKey),
  });
  if (!isSent) return; // for example no amount: keep what was typed
  setAmount('');
  setDescription('');
  amountInput.current?.focus();
}}
```

The component gets the month on screen as a prop (`<QuickAdd month={month} />` in `month-page.tsx`), and keeps what you type in React state (`amount`, `description`, `categoryId`, `date`). On submit it calls one API function. It never builds a request or changes the month itself. The category card's add form calls the same `addExpense()`, so both ways of adding an expense take the same path from here on.

**Step 2. The API function names the endpoint.** Each function in `api/*-api.ts` matches one endpoint.

Listing 3-2. One API function per endpoint. Excerpt from `web/scripts/api/expenses-api.ts`, lines 20–22.

```ts
export function addExpense(monthKey: string, expense: NewExpense): boolean {
  return monthPageState.recordEdit('addExpense', { month: monthKey }, { id: createUniqueId(), ...expense });
}
```

The function gives the expense its id here, on the device. Chapter 6 explains why the id can't wait for the server.

**Step 3. The page's state records the edit.** `monthPageState` in `sync/month-page-state.ts` keeps everything the page shows. Every edit enters through its `recordEdit()`, which does two things in order.

Listing 3-3. Recording an edit. Excerpt from `web/scripts/sync/month-page-state.ts`, lines 79–84.

```ts
recordEdit<Name extends EndpointName>(name: Name, params: ParamsOf<Name>, body: BodyInputOf<Name>): boolean {
  if (!unsavedEditsOutbox.add(name, params, body)) return false;
  if (this.#snapshot.refusedEditText) this.#update({ refusedEditText: null });
  this.#showOptimisticMonth();
  return true;
}
```

First, the edit goes into the outbox in `sync/unsaved-edits-outbox.ts`. `add()` checks the request against the endpoint, keeps it in a list that is also saved in the browser's localStorage, and starts sending (Listing 3-4). Second, `#showOptimisticMonth()` draws the month again with the edit on top (step 4). The second line clears a "not saved" message from an earlier edit (Chapter 7).

Listing 3-4. The outbox accepts an edit. Excerpt from `web/scripts/sync/unsaved-edits-outbox.ts`, lines 54–60.

```ts
add<Name extends EndpointName>(name: Name, params: ParamsOf<Name>, body: BodyInputOf<Name>): boolean {
  if (!isValidBody(name, body)) return false;
  this.#edits.push({ name, params, body });
  saveEdits(this.#edits);
  void this.#sendUnsavedEdits();
  return true;
}
```

`isValidBody` uses the same zod schema the Worker uses, so an amount of 0 is refused here, before any request, and the month on screen doesn't change. `#sendUnsavedEdits` sends the unsaved edits one at a time, oldest first, through `callEndpoint` in `api/endpoint-http-client.ts`, which makes the HTTP request: `POST /api/months/2026-11/expenses` with the expense as JSON.

**Step 4. The page draws the edit before the server answers.** This is an **optimistic update**: the page shows the edit as if the server had already saved it. The page never changes its copy of the month directly. It keeps the **saved month**, the server's last answer, and always draws that month with the outbox's unsaved edits applied on top.

Listing 3-5. The month to show. Excerpt from `web/scripts/sync/optimistic-month.ts`, lines 20–33.

```ts
export function buildOptimisticMonth(savedMonth: MonthData, unsavedEdits: readonly UnsavedEdit[]): MonthRecord {
  const month = new MonthRecord(savedMonth);
  for (const edit of unsavedEdits) {
    if (edit.params.month !== month.monthKey || !isMonthEdit(edit.name)) continue;
    const request = checkedRequest(edit.name, edit);
    if (!request) continue;
    try {
      applyEditToMonth(month, edit.name, request);
    } catch (error) {
      if (!(error instanceof MonthRuleError)) throw error;
    }
  }
  return month;
}
```

The function starts from a fresh copy of the saved month, then applies each unsaved edit for that month in order. `applyEditToMonth` runs the same edit table the Worker runs (Chapter 4, step 4), so the page's early version matches what the server will answer. An edit that breaks a rule, for example because someone else removed its category, is skipped here; the server refuses it too.

### Chapter 4. In the Worker

**Step 1. The entry point picks the household.** Every request arrives in `worker/worker-entry-point.ts`. It sends paths under `/api/months/`, `/api/export` and `/api/import` to `handleApiEndpointRequest`.

Listing 4-1. Where the request came from, who sent it, and which household it is for. Excerpt from `worker/worker-entry-point.ts`, lines 62–87, shortened.

```ts
async function handleApiEndpointRequest(request: Request, env: Env, context: WorkerContext): Promise<Response> {
  if (isRequestFromAnotherSite(request) || (request.method !== 'GET' && !isRequestFromOwnPage(request))) {
    return textResponse('Forbidden', 403);
  }
  return forwardToHouseholdDurableObject(request, env, context);
}

async function forwardToHouseholdDurableObject(request: Request, env: Env, context: WorkerContext): Promise<Response> {
  let householdName: string;
  try {
    const email = await resolveSignedInUserEmail(request, env, context);
    householdName = findHouseholdNameForEmail(email, env);
  } catch (error) {
    // ... a failed sign-in or an unknown email answers 403
  }
  const householdDurableObject = env.HOUSEHOLD_DURABLE_OBJECTS.getByName(householdName);
  return householdDurableObject.fetch(request);
}
```

The first function refuses requests that another website started (`sign-in/same-origin-request-check.ts`, Chapter 8). The second asks Cloudflare Access who is signed in (`sign-in/signed-in-user-resolver.ts`) and looks up their household in the `HOUSEHOLD_MEMBERS` secret (`sign-in/household-membership-lookup.ts`). It then forwards the request to that household's Durable Object.

This is the only place a household is chosen. `getByName("home")` always reaches the same Durable Object, and Cloudflare gives each Durable Object its own storage. Everything after this step runs inside the household's Durable Object and can only see that household's months, so no later code looks a household up.

**Step 2. The household Durable Object hands HTTP requests to the router.**

Listing 4-2. The Durable Object and its front door. Excerpt from `worker/household-durable-object/household-durable-object.ts`, lines 27–44, shortened.

```ts
constructor(state: DurableObjectState, env: Env) {
  super(state, env);
  this.#operationContext = {
    monthRepository: new DurableObjectMonthRepository(state.storage),
    liveUpdateConnections: new LiveUpdateConnectionManager(state),
  };
}

override async fetch(request: Request): Promise<Response> {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return routeApiRequestToOperation(request, this.#operationContext);
  }
  const { 0: deviceSocket, 1: serverSocket } = new WebSocketPair();
  this.#operationContext.liveUpdateConnections.acceptConnection(serverSocket);
  return new Response(null, { status: 101, webSocket: deviceSocket });
}
```

`state.storage` is this household's storage. The constructor wraps it in the two tools every operation uses, the **operation context**: `monthRepository` reads and writes months, and `liveUpdateConnections` sends updates to the household's open pages. An ordinary request goes to the router with that context. A WebSocket request becomes a live-update connection (Chapter 5).

> **Sidebar: the class has two names.** The code calls the class `HouseholdDurableObject`. Cloudflare stores every household's months under the name it had when it was first deployed, `HouseholdRoom`, so `worker-entry-point.ts` exports it under that name and `wrangler.jsonc` binds that name. Changing the stored name needs a Durable Object rename migration; otherwise Cloudflare treats it as a new class with empty storage.

**Step 3. The router finds the endpoint and checks the request.**

Listing 4-3. From request to operation. Excerpt from `worker/household-durable-object/api-request-router.ts`, lines 21–57, shortened, with notes added.

```ts
export async function routeApiRequestToOperation(request: Request, context: OperationContext): Promise<Response> {
  const { pathname } = new URL(request.url);
  for (const name of Object.keys(endpoints) as EndpointName[]) {
    const endpoint = endpoints[name];
    if (endpoint.method !== request.method) continue;
    const rawParams = matchPath(endpoint.path, pathname);
    if (rawParams) return runOperation(name, rawParams, request, context);
  }
  return errorResponse(404, { error: 'Not found' });
}

// in runOperation:
const params = endpoint.params.safeParse(rawParams); // 400 when the path is wrong
const body = endpoint.body.safeParse(rawBody); // 400 when the body is wrong
const operation = operationRegistry[name] as Operation<EndpointName>;
const result = await operation({ params: params.data, body: body.data }, context);
return jsonResponse(200, result);
// MonthRuleError -> 409 with the rule that was broken
```

The router walks the same endpoint table the page used. Our request matches `addExpense`, whose entry is in Listing 4-4. The router checks the path parameters and the body against the entry's zod schemas, then looks up the operation with the same name in `operations/operation-registry.ts`. The operation receives typed values in range and never checks shapes itself.

Listing 4-4. The addExpense entry in the endpoint table. Excerpt from `shared/api/endpoints.ts`, lines 66–71.

```ts
addExpense: endpoint(
  'POST',
  '/api/months/:month/expenses',
  InMonth,
  z.object({ id: Id, categoryId: Id, amount: PositiveAmount, description: OptionalText, date: IsoDate }),
),
```

`InMonth` says the path has one parameter, `month`, in the form `YYYY-MM`. The field shapes (`Id`, `PositiveAmount` and so on) live in `shared/api/fields.ts`, so every endpoint uses the same limits: ids up to 64 characters, amounts up to 10 million, text up to 200 characters.

**Step 4. The operation runs the edit.** Each endpoint has one function in `operations/`, named after it and grouped with similar ones: `add-operations.ts`, `change-operations.ts`, `remove-operations.ts`, `read-operations.ts` and `backup-operations.ts`.

Listing 4-5. The addExpense operation. Excerpt from `worker/household-durable-object/operations/add-operations.ts`, lines 12–14.

```ts
/** POST /api/months/:month/expenses: adds an expense. */
export const addExpenseOperation: Operation<'addExpense'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) => editsByEndpoint.addExpense(month, request));
```

Every editing operation looks like this. `loadEditSaveAndBroadcastMonth` holds the four steps every edit follows.

Listing 4-6. The steps of every edit. Excerpt from `worker/household-durable-object/load-edit-save-and-broadcast-month.ts`, lines 14–25.

```ts
export async function loadEditSaveAndBroadcastMonth(
  context: OperationContext,
  monthKey: string,
  applyEdit: (month: MonthRecord) => void,
): Promise<MonthResponse> {
  const month = await context.monthRepository.loadMonthOrCreateFromClosestMonth(monthKey);
  applyEdit(month);
  await context.monthRepository.saveMonth(month);
  const response = await buildMonthResponse(context, month);
  context.liveUpdateConnections.sendMonthToDevicesWatchingIt(response);
  return response;
}
```

1. **Load.** The repository reads the month from storage, or creates it from the closest saved month if it doesn't exist yet.
2. **Edit.** `applyEdit` is the endpoint's edit from `shared/month/apply-edit-to-month.ts` (Listing 4-7).
3. **Save.** The repository writes the month and raises the household's revision number by one (Chapter 5).
4. **Broadcast.** The connection manager sends the new month to every device showing it. The same month is the answer to the request.

Listing 4-7. What each edit does to the month. Excerpt from `shared/month/apply-edit-to-month.ts`, lines 24–29.

```ts
export const editsByEndpoint: {
  [Name in MonthEditName]: (month: MonthRecord, request: MonthEditRequest<Name>) => void;
} = {
  addExpense: (month, { body }) => month.addExpense(body),
  changeExpenseAmount: (month, { params, body }) => month.updateExpenseAmount(params.id, body.amount),
  removeExpense: (month, { params }) => month.removeExpense(params.id),
  // ... one line per editing endpoint
```

This table is the one place that says what each endpoint does to a month. The Worker's operations run it on the stored month; the page runs it, through `applyEditToMonth`, on its copy for unsaved edits (Listing 3-5).

**Step 5. The model enforces the month's rules.** `MonthRecord` in `shared/month/month-record.ts` is the only code that changes month data.

Listing 4-8. Adding an expense. Excerpt from `shared/month/month-record.ts`, lines 184–207, shortened, with notes added.

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

The operation's answer travels back to the outbox, and the outbox gives it to the page's state.

Listing 5-1. The page's state keeps a month from the server. Excerpt from `web/scripts/sync/month-page-state.ts`, lines 135–148.

```ts
/** A month the server saved. Answers can arrive out of order, so only a newer revision is used. */
#showSavedMonth(answer: MonthResponse): void {
  if (answer.month.month !== this.#shownMonthKey || answer.revision < this.#savedRevision) return;
  this.#savedRevision = answer.revision;
  this.#savedMonth = answer.month;
  this.#update({ savedMonthKeys: answer.monthKeys, errorText: null });
  this.#showOptimisticMonth();
}

/** Shows the saved month with the edits not saved yet on top. */
#showOptimisticMonth(): void {
  if (!this.#savedMonth) return;
  this.#update({ month: buildOptimisticMonth(this.#savedMonth, unsavedEditsOutbox.unsavedEdits) });
}
```

The outbox has already dropped the answered edit, so the month on screen is now the saved month with only the edits still unsaved. `#update` makes a new snapshot and tells every subscriber. The month page subscribes with React's `useSyncExternalStore`, so React draws it again (Listing 5-2). On screen nothing moves: the expense was already shown, and now it is the server's copy.

Listing 5-2. The month page reads the page's state. Excerpt from `web/scripts/pages/month-page.tsx`, lines 26–30.

```tsx
export function MonthPage() {
  const { month, savedMonthKeys, saveStatus, errorText, refusedEditText } = useSyncExternalStore(
    monthPageState.subscribe,
    monthPageState.getSnapshot,
  );
```

The page passes `month` to every feature, for example `<QuickAdd month={month} />`. The page's state is the only place that keeps month data on the page.

Three kinds of message reach `#showSavedMonth`: the answer to an edit, the answer to opening a month (`GET /api/months/:month`), and a live update from the WebSocket. They can arrive in any order. Every answer carries a **revision**, a number the household raises by one with every save. The page ignores anything older than what it shows, so a late answer can't replace a newer month.

The other devices get the month through their WebSocket. Each page tells its household which month it shows (the `watchMonth` message in `shared/live-update-messages.ts`). After every save, `live-update-connection-manager.ts` sends the month to the sockets watching it. On those pages, `sync/live-update-connection.ts` passes the month to the same `#showSavedMonth`.

> **Sidebar: the WebSocket costs almost nothing.** Cloudflare answers the keepalive ping without waking the Durable Object, and messages sent to a device are free. The socket stays open while the Durable Object sleeps between requests.

> **Sidebar: a socket that died quietly.** After a laptop sleeps or a phone changes networks, the browser can report a socket as open for a minute or more while nothing gets through. So the page doesn't trust the socket's state. Every 50 seconds, and whenever the page becomes visible again or the browser reports it is back online, `#checkAlive()` sends a ping. Without any message back within 10 seconds, the page closes that socket, connects again, and loads the month again to catch up.

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

Meanwhile the screen shows every unsaved edit (Listing 3-5). The outbox sends edits one at a time, in order, so a later edit never reaches the server before an earlier one.

`saveStatusFor()` in `sync/save-status.ts` decides what the save status says, from two facts: whether the live connection is open, and the outbox's state. Without the live connection the status says offline even when the outbox is empty, because the page can't know whether it shows the latest month.

When the server refuses an edit for good (a 400 or 409 answer), the outbox drops it, the status shows "Not saved", and the page loads the month again to show the server's version. The red banner says why: `refusedEditMessage()` in `sync/refused-edit-message.ts` picks a message for the broken rule, for example "A change wasn't saved: its category no longer exists." The banner stays until the next edit.

> **Sidebar: a refused offline edit.** You remove the Gifts category on the train; meanwhile your sister adds a gift expense at home. Your phone shows Gifts gone until it reconnects. Then the server refuses the removal (409, `category-has-expenses`), the banner says the category has expenses, and Gifts comes back on your screen with her expense in it. The data stays correct; your edit is the one that loses.

### Chapter 8. Who may call what

Cloudflare Access sits in front of the whole site and asks for a sign-in. Behind it, the Worker checks three things on every endpoint call (Listing 4-1):

1. **The sign-in.** `sign-in/signed-in-user-resolver.ts` gets the email from Cloudflare Access. Without a verified email, the answer is 403.
2. **The household.** `sign-in/household-membership-lookup.ts` maps the email to a household through the `HOUSEHOLD_MEMBERS` secret. Each household has its own Durable Object, so one household can't reach another's months.
3. **The origin.** A browser sends the sign-in cookie with requests that other websites start too. The Worker refuses any request the browser marks as coming from another site, and any edit without this site's own Origin header.

For local testing, `ACCESS_TEST_BYPASS_EMAIL` in `.dev.vars` replaces the sign-in. It works only when the host is `localhost` or `127.0.0.1`, so it can't open the real site.

---

## Part IV. Changing the app

### Chapter 9. Adding an endpoint

Suppose you want to rename an expense. Each step below is in a different layer, and TypeScript or the tests point out a missing step.

1. **Model.** Add `renameExpense(expenseId, newName)` to `MonthRecord` in `shared/month/month-record.ts`. Throw `MonthRuleError` for a broken month rule, and add the rule's name to `MonthRule`. A new rule also needs its message in `sync/refused-edit-message.ts` and both translation files; TypeScript fails until it has one.
2. **Endpoint.** Add `renameExpense` to `endpoints` in `shared/api/endpoints.ts`, for example `PUT /api/months/:month/expenses/:id/description` with `ItemInMonth` and a body of `z.object({ description: Text })`.
3. **Edit.** Add one line to `editsByEndpoint` in `shared/month/apply-edit-to-month.ts`. TypeScript fails until you do, because the table must cover every editing endpoint.
4. **Operation.** Add `renameExpenseOperation` to `operations/change-operations.ts`, written like the others there, then add it to `operations/operation-registry.ts`. TypeScript fails until the registry has it.
5. **API function.** Add `renameExpense()` to `web/scripts/api/expenses-api.ts`; it calls `monthPageState.recordEdit('renameExpense', ...)`.
6. **Feature.** Call it from the feature that shows the expense, for example `features/categories/category-card.tsx`.
7. **Tests.** Add a model test in `test/month-record.test.mjs` and an endpoint call in `test/api-operations.test.mjs`. `test/endpoints.test.mjs` already checks that no two endpoints match the same request.

An endpoint that only reads (like `getMonth`) skips steps 1 and 3: its operation reads from `context.monthRepository` instead of calling `loadEditSaveAndBroadcastMonth` (see `read-operations.ts`), and its API function calls `callEndpoint` directly instead of `recordEdit`.

### Chapter 10. Adding a part of the screen

1. Create `web/scripts/features/<name>/<name>.tsx` with a component that takes the month as a prop, for example `export function SavingsGoal({ month }: { month: MonthRecord })`. It returns its markup, keeps what someone types in React state, and calls API functions in its event handlers.
2. Place it in `pages/month-page.tsx`, inside the part of the layout it belongs to.
3. Give it text with `t('savingsGoal.title')`, and add every id to both `web/i18n/en.json` and `web/i18n/el.json`. `npm test` fails when an id is missing from either.
4. Add a test in `test/components.test.tsx`: render it with a month, click or type, and check which API function it called.

### Chapter 11. Checking a change

- `npm run check` runs Prettier, ESLint (including the layer rule), the type checker and the unit tests.
- `npm run dev` and `npm run seed` run the real Worker on your computer with made-up months; see "Try changes locally" in the README.
- `curl` reaches any endpoint while `npm run dev` runs; an edit needs `-H "Origin: http://localhost:8787"`.

---

## Appendix A. Files

| File                                                                    | Layer                    | What it holds                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `shared/month/month-record.ts`                                          | shared                   | `MonthRecord`: one month's data and its rules; `MonthRuleError`                                                    |
| `shared/month/categories.ts`                                            | shared                   | default categories, colours, limits                                                                                |
| `shared/month/month-validation.ts`                                      | shared                   | month keys, the basic shape of a month file, which month a new one copies                                          |
| `shared/month/amounts.ts`                                               | shared                   | rounding to cents, sums                                                                                            |
| `shared/api/endpoints.ts`                                               | shared                   | every endpoint: method, path, params, body; response types                                                         |
| `shared/api/fields.ts`                                                  | shared                   | shapes of ids, amounts, text, dates                                                                                |
| `shared/month/apply-edit-to-month.ts`                                   | shared                   | `editsByEndpoint`: what each editing endpoint does to a month; `applyEditToMonth`                                  |
| `shared/live-update-messages.ts`                                        | shared                   | the two WebSocket messages: `watchMonth` and `month`                                                               |
| `web/scripts/main.tsx`                                                  | entry                    | loads translations, draws the month page, connects to the server                                                   |
| `web/scripts/pages/month-page.tsx`                                      | page                     | lays out every feature with the page's state                                                                       |
| `web/scripts/features/*/`                                               | feature                  | one folder per part of the screen                                                                                  |
| `web/scripts/components/`                                               | component                | entry rows, editable amounts and texts                                                                             |
| `web/scripts/api/*-api.ts`                                              | API                      | one function per endpoint; edits go through `monthPageState.recordEdit`                                            |
| `web/scripts/api/endpoint-http-client.ts`                               | http client              | `callEndpoint`: one HTTP request; `ApiError`, `OfflineError`                                                       |
| `web/scripts/sync/month-page-state.ts`                                  | sync                     | `monthPageState`: what the page shows, `recordEdit()`, and every way the state changes                             |
| `web/scripts/sync/unsaved-edits-outbox.ts`                              | sync                     | sends edits in order; keeps them while offline                                                                     |
| `web/scripts/sync/optimistic-month.ts`                                  | sync                     | `buildOptimisticMonth`: the saved month with the unsaved edits on top                                              |
| `web/scripts/sync/live-update-connection.ts`                            | sync                     | the WebSocket for other people's edits; replaces a socket that stops answering                                     |
| `web/scripts/sync/save-status.ts`                                       | sync                     | `saveStatusFor`: what the save status says                                                                         |
| `web/scripts/sync/refused-edit-message.ts`                              | sync                     | `refusedEditMessage`: why the server refused an edit, for the banner                                               |
| `worker/worker-entry-point.ts`                                          | entry point              | routing, origin check, sign-in, forwarding to the household's Durable Object                                       |
| `worker/sign-in/`                                                       | sign-in                  | `signed-in-user-resolver.ts`, `household-membership-lookup.ts`, `same-origin-request-check.ts`                     |
| `worker/household-durable-object/household-durable-object.ts`           | household Durable Object | one per household; builds the operation context                                                                    |
| `worker/household-durable-object/api-request-router.ts`                 | API request router       | request to operation, errors to status codes                                                                       |
| `worker/household-durable-object/operations/`                           | operations               | `add-`, `change-`, `remove-`, `read-` and `backup-operations.ts`; `operation-registry.ts` maps names to operations |
| `worker/household-durable-object/load-edit-save-and-broadcast-month.ts` | edit steps               | the four steps every edit follows                                                                                  |
| `worker/household-durable-object/operation-context.ts`                  | operation context        | `OperationContext`, `buildMonthResponse`                                                                           |
| `worker/household-durable-object/durable-object-month-repository.ts`    | storage                  | months and the revision in Durable Object storage                                                                  |
| `worker/household-durable-object/live-update-connection-manager.ts`     | live updates             | which device shows which month; sending updates                                                                    |
| `eslint/layers.mjs`                                                     | tooling                  | the layer rule                                                                                                     |

## Appendix B. Glossary

- **Durable Object.** A Cloudflare server instance with its own storage. This app runs one per household and gives it the household's name as its id.
- **Endpoint.** One HTTP method and path that does one thing, listed in `shared/api/endpoints.ts`.
- **Operation.** The Worker function that answers one endpoint, grouped by what it does in `worker/household-durable-object/operations/`.
- **Operation context.** What every operation receives besides the request: the household's month repository and live-update connections.
- **Month key.** A month as `YYYY-MM`, for example `2026-11`. Keys sort by date as plain text.
- **Optimistic update.** Showing an edit before the server saves it. The page draws the saved month with the unsaved edits on top.
- **Outbox.** The page's list of edits not yet answered by the server, in `sync/unsaved-edits-outbox.ts`.
- **Revision.** A number the household raises by one with every save; the page uses it to ignore older answers.
- **Saved month.** The server's last answer for the month on screen.
- **Unsaved edit.** An edit in the outbox that the server hasn't answered yet. The page shows it on top of the saved month.
- **zod.** A library that describes the shape of data and checks real data against it. The app uses its smaller form, `zod/mini`, to keep the page small.
