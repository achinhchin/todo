# Todo: project structure

A daily todo and time-tracking web app for two fixed users, `model` and `chinchin`. It has a Go server with SQLite and a frontend in plain HTML, CSS and JS with no framework and no build step.

## Code style (must keep)
- Compact code with **no comments**, short names and dense one-liners, matching the existing files.
- No frameworks or bundlers. The only external resource is Google Fonts.
- Keep the files small.

## Layout
```
Todo/
├── settings.json   {"port": 1234}, read at startup (default 1234)
├── main.go         HTTP server, SQLite, in-memory cache, stats
├── go.mod/go.sum   module "todo", dependency modernc.org/sqlite (pure Go, no cgo)
├── todo.db         created at runtime (WAL mode), not source
├── todo            built binary
└── web/            static files served from disk at "/" (http.Dir("web"), not embedded)
    ├── index.html  header (date nav, view/mode/user toggles, #cal), <main id=app>, <dialog id=dlg> time editor, #selbar, #hap
    ├── style.css   CSS variables for theme, grain overlay, responsive rules
    └── app.js      all state, rendering and events
```
Run with `go build -o todo . && ./todo`, then open http://localhost:1234. The server must be started from the project directory because it uses relative paths for `settings.json`, `todo.db` and `web/`.

## Data model
SQLite table `tasks`:
| col | type | meaning |
|---|---|---|
| id | INTEGER PK | |
| user | TEXT | `model` or `chinchin` |
| date | TEXT | `YYYY-MM-DD` (local day) |
| ord | INTEGER | display order within (date,user); new task = max+1 |
| title, detail | TEXT | |
| s | INTEGER | start, minutes from 00:00 of `date`; **-1 = no time** |
| e | INTEGER | end in minutes; **-1 = fixed time** (only `s`), ≥0 = range |
| d | INTEGER | 1 = done (checkbox). Added by an `ALTER TABLE` at startup |
| p | INTEGER | legacy "parallel" flag. It may exist in old DBs but is **unused** |

**Times after midnight:** a value ≥ 1440 means the next day (`⁺¹`). Values are capped at 2879.

## Timeline rule
This rule is implemented twice and **the two copies must stay in sync**: `durations()` in main.go and `tl()` in app.js.
1. Take the timed tasks and sort them by `s`.
2. `end` = max(1440, max of s and e).
3. Work out each task's interval:
   - range: s to e;
   - fixed: s to the start of the next task with a larger `s`, or to `end`.
4. Paint the intervals onto a minute array of length `end`, in priority order: **not-done first, then done**, each group in start order. Later paints overwrite earlier ones, so:
   - **done tasks win any overlap**;
   - otherwise the later-starting task wins (e.g. Lunch carves a hole out of Work).
5. Join consecutive minutes owned by the same task into segments `sg` = `{t,id,k,n,d,s,e}`.
6. Totals per title (`key = title.trim().toLowerCase()`) come from the painted minutes, so there is never any double counting.

## API (main.go)
- `GET /api/tasks?dates=d1,d2,...` returns a `[]Task` for those dates (both users, ordered by ord,id).
- `POST /api/tasks` with a Task JSON body: `id=0` inserts (ord is set automatically), otherwise the task is updated. Missing `s`/`e` default to -1. It returns the saved Task.
- `POST /api/order` with body `{date, ids:[...]}` sets `ord` to 1..n in one transaction. It is used by Sort and by drag-reorder.
- `POST /api/bulk` with body `{del:[ids], put:[tasks]}`, in one transaction:
  - `del` deletes those tasks;
  - `put` updates **only `s`/`e`**. It is used by select-mode shift and delete.
- `DELETE /api/tasks/{id}`
- `GET /api/stats` returns `{titles:[displayName...], total:{user:{lowerTitle:minutes}}}`.
  - `titles` is ordered by the first task id that used each title. It drives the stable colour index, so the same title has the same colour for both users.

**Cache:** the server keeps `cache map[date][]Task` and `stats` behind an RWMutex. `invalidate(dates...)` clears the given dates and the stats on every write.

## Frontend (app.js)
**State `S`:**
- `date`: selected ISO date.
- `view`: `day` or `week`.
- `mob`: `split` or `tabs`, stored in localStorage.
- `who`: the active user tab, stored in localStorage.
- `tasks`: tasks for the current view's dates.
- `stats`, plus `ci` (colour index map) and `nm` (lowercase key → display name map).
- `tok`: request token that drops stale loads.
- `open`: id of the inline-expanded task.
- `sel`: a Set while select mode is on, else null.
- `ed`: the task being time-edited, as a live object reference.
- `tm`: the dialog's time mode.
- `lp`: the flag that suppresses the click after a long-press.
- `cal`: the month shown in the calendar.

**Rendering:**
- `render()` fills `#app` with `.cols` holding one `.col[data-u]` per user, sets `body[data-mob|who|view|sel]` and toggles `#selbar`.
- `dayCol(u)` contains:
  - a `.sum` card with `bar(t,0,now)`, then `ring(t.sg)` and `lg(agg(t.sg))`. There is no colour key under the bar; the ring legend is the only one;
  - the `.list` of `item()`s;
  - an `.acts` row with: + add a task, ⇅ Sort by time, ☑ Select.
- `weekCol(u)`: weeks run Mon–Sun (`wk()`). It shows 7 `.wr` rows (small clock ring + bar) and an "All time" `pie()` with its legend, built from `stats.total`.
- `bar()` draws the `.bars` wrapper → `lane()` of `<i>` segments, plus the now marker `<u>`, an hour grid made from `--h`, and the 6-hourly `.scale`.
- **Clock ring:** `ring(sg)` is a 24h dial (00:00 at the top, clockwise). Segments past midnight wrap around. It draws tick marks at 0/6/12/18, and the centre shows the total.
- `pie(agg)` is the proportional ring used only for All time. Both rings go through `svg()`, with r=15.9155 so the circumference is 100.
- **Done styling:** segments that are not done get class `f` (opacity .32) in both bar and ring. Done segments are drawn solid.
- `col(k)` returns `hsl(index*137.508+18, 44%, 54%)`, using the index from `stats.titles`, with a hash as fallback.
- **Now:** `nowM()` gives the current minute when viewing today, or minute+1440 when viewing yesterday, and null otherwise. The task whose segment contains it gets `.it.now` and a "now" pill.
- **Sort by time:** `sortT(u)` groups each timed task with the untimed tasks that follow it. Untimed tasks at the very top stay there. The groups are sorted by `s` and saved with `/api/order`.
- `cal(monthIso)` builds the custom calendar popover, with a dot on days that have tasks.

**Task item:**
- Collapsed it shows `[.cb checkbox] [time (if any)] [title/detail]`. In select mode a `.ck` circle replaces the checkbox. Done tasks get `.dn`, which shows the title struck through.
- Tapping a task sets `S.open` and renders the expanded `.it.open`. The expanded task has:
  - a header row with:
    - the checkbox;
    - `.tbtn`: a time chip, or "+ Add time" when there is no time. It opens the time dialog through `openTime(t)`;
    - Delete and Done buttons.
  - `.et` title input and `.ed` detail textarea (auto-sized by `sz()`), styled as dashed "editable" fields. They save on `change`, which fires on blur or Enter.
- Tapping outside, Done or Esc runs `close()`. `close()` blurs first so the field saves. A task left with an empty title and empty detail is deleted.
- **Adding a task** (`addT`): a temporary task with a negative id is pushed and its title focused **synchronously**, so the iOS keyboard opens. Then it is POSTed, and `t._p` (that promise) swaps in the real id. `save(t)` awaits `t._p` first.
  - Default time comes from `nw(u)`: after a range, the new task continues from that range's end with the same length; after a fixed time, it starts 30 minutes later; otherwise there is no time.
- **Checkbox:** `data-cb` toggles `t.d`, plays haptic feedback and saves.
- **Long-press reorder:**
  - A 380 ms press on a collapsed `.it` starts a drag (`lp`). Moving more than 8 px before that cancels it, so the page can scroll.
  - While dragging, `touchmove` is prevented, siblings swap as you pass their midpoints, and the nearest scroller (the `.col` in split mode) auto-scrolls.
  - On release, the new order is sent with `/api/order`.
- **Haptics:** `hap()` calls `navigator.vibrate(10)` (Android) and also clicks `#hap`, an `<input type=checkbox switch>`, which gives haptic feedback on iOS 18 Safari. The document click handler ignores clicks inside `#hap`.
- **Select mode:** `#selbar` shows the count, Shift (−1h, −15m, +15m, +1h) and Delete.
  - `shift(d)` clamps the shift so the whole selection stays inside 0–2879, then calls `/api/bulk`.
  - Delete (single or bulk) runs immediately, with no confirmation.

**Time dialog** (`#dlg`, time only):
- Controls: the No time / Fixed / Range switch, the `#pk` timeline picker, start/end `<input type=time>` with "next day" checkboxes, Cancel and Save.
- Picker:
  - `drawPk()` draws one row, or two rows of 12h when the dialog is narrower than 480px.
  - It shows the user's other segments dimmed, plus `.sel` and drag pins (`em.pin.s` above the row, `em.pin.e` below the scale).
  - Times snap to 15 min via `pkM()`.
  - In fixed mode a tap or drag sets the time. In range mode a drag selects a span, and a tap moves the nearer edge.
  - `pk.d.dy` keeps a pin drag on its own row.
  - `setT()` writes the inputs, and `f.oninput=drawPk` keeps the picker in sync when someone types.
- Untimed tasks open the dialog in Fixed mode at the current time, rounded to 15 minutes (09:00 on other days).

**Events:**
- A single delegated `document.onclick` dispatches on the `id` and `data-*` attributes: `v m w th t cm cd cb tt del done sel sh sd sx srt u id d`.
- A `change` listener saves inline edits, and an `input` listener auto-sizes textareas.
- The ←/→ keys change the day.
- Data is polled every 15 s, and reloaded when the tab becomes visible again. Both are **skipped while `busy()`**: dialog open, drag active, or an input inside `#app` focused. This is because `render()` replaces `innerHTML` and would kill the focus.

## Styling (style.css)
- Tokens: `--paper --card --ink --mute --line --acc --gl`.
- Theme:
  - It follows the system setting unless `html[data-th=light|dark]` is set (Auto/Light/Dark buttons, stored in localStorage).
  - The dark tokens are repeated in the `prefers-color-scheme` block and in `:root[data-th=dark]`. Keep the two copies in sync.
- **Paper grain:** `--grain` is a single fine `feTurbulence` noise SVG data URI. It is applied by `body::before` (fixed, z-index 99), with opacity `--go` (.2 in light, .06 in dark) and blend `--gb` (multiply in light, screen in dark).
- Fonts are `--hd` (Fraunces) and `--bd` (Source Serif 4).
- Breakpoint is `max-width:819px`:
  - `.mobo` toggles are shown.
  - **Tabs:** one `.col` at a time (`#who`).
  - **Split (day):** a horizontal split. `body` becomes a 100dvh flex column, `.cols` has two rows of 1fr, and each `.col` scrolls on its own with a sticky `h2`. The bar and ring are kept in a compact form.
  - **Split (week):** the columns stack.

## Notes and gotchas
- There is no auth or user management; the users are hard-coded in `U` in app.js.
- The stats cache rebuilds by scanning the whole table after any write. That is fine at this scale.
- Never write an `on*` handler as `e=>cond&&x()`. When `cond` is false, the handler returns `false`, which cancels the event's default action. That bug once stopped the dialog's Save button from submitting.
- `[hidden]{display:none!important}` is needed because classes like `.tr{display:flex}` would otherwise override the `hidden` attribute.
- On macOS, copying a rebuilt binary over a running or recently signed one can make it get killed silently. Rebuild it in place with `go build -o`.
