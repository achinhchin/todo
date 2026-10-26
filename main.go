package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"

	_ "modernc.org/sqlite"
)

type Task struct {
	ID     int64  `json:"id"`
	User   string `json:"user"`
	Date   string `json:"date"`
	Ord    int    `json:"ord"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
	S      int    `json:"s"`
	E      int    `json:"e"`
	D      int    `json:"d"`
	Par    int64  `json:"par"`
}

var (
	db    *sql.DB
	mu    sync.RWMutex
	cache = map[string][]Task{}
	stats any
)

func dayTasks(date string) []Task {
	mu.RLock()
	t, ok := cache[date]
	mu.RUnlock()
	if ok {
		return t
	}
	rows, err := db.Query(`SELECT id,user,date,ord,title,detail,s,e,d,par FROM tasks WHERE date=? ORDER BY ord,id`, date)
	if err != nil {
		return nil
	}
	defer rows.Close()
	t = []Task{}
	for rows.Next() {
		var x Task
		rows.Scan(&x.ID, &x.User, &x.Date, &x.Ord, &x.Title, &x.Detail, &x.S, &x.E, &x.D, &x.Par)
		t = append(t, x)
	}
	mu.Lock()
	cache[date] = t
	mu.Unlock()
	return t
}

func durations(ts []Task, out map[string]int) {
	type iv struct {
		s, e, d int
		k       string
	}
	var tm []Task
	var v []iv
	end := 1440
	for _, t := range ts {
		if t.S >= 0 && t.Par == 0 {
			tm = append(tm, t)
			end = max(end, t.S, t.E)
		}
	}
	sort.SliceStable(tm, func(i, j int) bool { return tm[i].S < tm[j].S })
	for i, t := range tm {
		e := t.E
		if e < 0 {
			e = end
			for _, x := range tm[i+1:] {
				if x.S > t.S {
					e = x.S
					break
				}
			}
		}
		v = append(v, iv{t.S, min(e, end), t.D, strings.ToLower(strings.TrimSpace(t.Title))})
	}
	sort.SliceStable(v, func(i, j int) bool { return v[i].d < v[j].d })
	own := make([]int, end)
	for i, x := range v {
		for m := x.s; m < x.e; m++ {
			own[m] = i + 1
		}
	}
	for _, o := range own {
		if o > 0 {
			out[v[o-1].k]++
		}
	}
}

func getStats() any {
	mu.RLock()
	s := stats
	mu.RUnlock()
	if s != nil {
		return s
	}
	rows, _ := db.Query(`SELECT id,user,date,ord,title,detail,s,e,d,par FROM tasks ORDER BY date,user,ord,id`)
	defer rows.Close()
	groups := map[string][]Task{}
	titles, seen := []string{}, map[string]bool{}
	var all []Task
	for rows.Next() {
		var x Task
		rows.Scan(&x.ID, &x.User, &x.Date, &x.Ord, &x.Title, &x.Detail, &x.S, &x.E, &x.D, &x.Par)
		groups[x.User+"|"+x.Date] = append(groups[x.User+"|"+x.Date], x)
		all = append(all, x)
	}
	sort.Slice(all, func(i, j int) bool { return all[i].ID < all[j].ID })
	for _, x := range all {
		if k := strings.ToLower(strings.TrimSpace(x.Title)); !seen[k] && x.Par == 0 {
			seen[k] = true
			titles = append(titles, strings.TrimSpace(x.Title))
		}
	}
	total := map[string]map[string]int{}
	for k, g := range groups {
		u := strings.Split(k, "|")[0]
		if total[u] == nil {
			total[u] = map[string]int{}
		}
		durations(g, total[u])
	}
	s = map[string]any{"titles": titles, "total": total}
	mu.Lock()
	stats = s
	mu.Unlock()
	return s
}

func invalidate(dates ...string) {
	mu.Lock()
	for _, d := range dates {
		delete(cache, d)
	}
	stats = nil
	mu.Unlock()
}

func send(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}

func main() {
	var cfg struct {
		Port        int
		Auth, Login string
		Test        bool
	}
	if b, err := os.ReadFile("settings.json"); err == nil {
		json.Unmarshal(b, &cfg)
	}
	if cfg.Port == 0 {
		cfg.Port = 1234
	}
	if cfg.Auth == "" {
		cfg.Auth = "http://localhost:1235"
	}
	var err error
	if db, err = sql.Open("sqlite", "todo.db?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"); err != nil {
		log.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	if _, err = db.Exec(`CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY AUTOINCREMENT,user TEXT,date TEXT,ord INTEGER,title TEXT,detail TEXT,s INTEGER DEFAULT -1,e INTEGER DEFAULT -1);CREATE INDEX IF NOT EXISTS idx_date ON tasks(date)`); err != nil {
		log.Fatal(err)
	}
	db.Exec(`ALTER TABLE tasks ADD COLUMN d INTEGER DEFAULT 0`)
	db.Exec(`ALTER TABLE tasks ADD COLUMN par INTEGER DEFAULT 0`)

	http.HandleFunc("GET /api/tasks", func(w http.ResponseWriter, r *http.Request) {
		out := []Task{}
		for _, d := range strings.Split(r.URL.Query().Get("dates"), ",") {
			out = append(out, dayTasks(d)...)
		}
		send(w, out)
	})
	http.HandleFunc("GET /api/stats", func(w http.ResponseWriter, r *http.Request) { send(w, getStats()) })
	http.HandleFunc("POST /api/tasks", func(w http.ResponseWriter, r *http.Request) {
		t := Task{S: -1, E: -1}
		if json.NewDecoder(r.Body).Decode(&t) != nil || t.Date == "" || t.User == "" {
			http.Error(w, "bad", 400)
			return
		}
		if t.ID == 0 {
			db.QueryRow(`SELECT COALESCE(MAX(ord),0)+1 FROM tasks WHERE date=? AND user=?`, t.Date, t.User).Scan(&t.Ord)
			res, _ := db.Exec(`INSERT INTO tasks(user,date,ord,title,detail,s,e,d,par) VALUES(?,?,?,?,?,?,?,?,?)`, t.User, t.Date, t.Ord, t.Title, t.Detail, t.S, t.E, t.D, t.Par)
			t.ID, _ = res.LastInsertId()
		} else {
			var old string
			db.QueryRow(`SELECT date FROM tasks WHERE id=?`, t.ID).Scan(&old)
			db.Exec(`UPDATE tasks SET user=?,date=?,ord=?,title=?,detail=?,s=?,e=?,d=?,par=? WHERE id=?`, t.User, t.Date, t.Ord, t.Title, t.Detail, t.S, t.E, t.D, t.Par, t.ID)
			invalidate(old)
		}
		invalidate(t.Date)
		send(w, t)
	})
	http.HandleFunc("POST /api/order", func(w http.ResponseWriter, r *http.Request) {
		var o struct {
			Date string
			IDs  []int64
		}
		if json.NewDecoder(r.Body).Decode(&o) != nil {
			http.Error(w, "bad", 400)
			return
		}
		tx, _ := db.Begin()
		for i, id := range o.IDs {
			tx.Exec(`UPDATE tasks SET ord=? WHERE id=? AND date=?`, i+1, id, o.Date)
		}
		tx.Commit()
		invalidate(o.Date)
		send(w, map[string]bool{"ok": true})
	})
	http.HandleFunc("POST /api/bulk", func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			Del []int64
			Put []Task
		}
		if json.NewDecoder(r.Body).Decode(&b) != nil {
			http.Error(w, "bad", 400)
			return
		}
		var ds []string
		tx, _ := db.Begin()
		for _, id := range b.Del {
			var d string
			tx.QueryRow(`SELECT date FROM tasks WHERE id=?`, id).Scan(&d)
			tx.Exec(`DELETE FROM tasks WHERE id=? OR par=?`, id, id)
			ds = append(ds, d)
		}
		for _, t := range b.Put {
			tx.Exec(`UPDATE tasks SET s=?,e=? WHERE id=?`, t.S, t.E, t.ID)
			ds = append(ds, t.Date)
		}
		tx.Commit()
		invalidate(ds...)
		send(w, map[string]bool{"ok": true})
	})
	http.HandleFunc("DELETE /api/tasks/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.Atoi(r.PathValue("id"))
		var d string
		db.QueryRow(`SELECT date FROM tasks WHERE id=?`, id).Scan(&d)
		db.Exec(`DELETE FROM tasks WHERE id=? OR par=?`, id, id)
		invalidate(d)
		send(w, map[string]bool{"ok": true})
	})
	fs := http.FileServer(http.Dir("web"))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			fs.ServeHTTP(w, r)
			return
		}
		h, _ := os.ReadFile("web/index.html")
		s := string(h)
		for _, f := range []string{"style.css", "app.js"} {
			if st, err := os.Stat("web/" + f); err == nil {
				s = strings.ReplaceAll(s, `"`+f+`"`, `"`+f+"?v="+strconv.FormatInt(st.ModTime().Unix(), 36)+`"`)
			}
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(s))
	})
	log.Printf("serving on :%d", cfg.Port)
	var h http.Handler = gate(cfg.Auth, cfg.Login, http.DefaultServeMux)
	if cfg.Test {
		h = http.DefaultServeMux
		log.Print("test mode: login disabled")
	}
	log.Fatal(http.ListenAndServe(":"+strconv.Itoa(cfg.Port), h))
}

func gate(auth, login string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req, _ := http.NewRequest("GET", auth+"/api/check", nil)
		if c, err := r.Cookie("llife"); err == nil {
			req.AddCookie(c)
		}
		if res, err := http.DefaultClient.Do(req); err == nil {
			res.Body.Close()
			if res.StatusCode == 204 {
				next.ServeHTTP(w, r)
				return
			}
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.Error(w, "unauthorized", 401)
			return
		}
		sc := "http"
		if r.Header.Get("X-Forwarded-Proto") == "https" || r.TLS != nil {
			sc = "https"
		}
		http.Redirect(w, r, login+"/?next="+url.QueryEscape(sc+"://"+r.Host+r.URL.RequestURI()), 302)
	})
}
