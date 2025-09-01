package main

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "modernc.org/sqlite"
)

type Message struct {
	Text string `json:"text"`
}

type Target struct {
	ArticleID int64 `json:"article_id"`
	Day       int64 `json:"day"`
}

type Article struct {
	ArticleID  int64  `json:"article_id"`
	Title      string `json:"title"`
	CleanTitle string `json:"clean_title"`
	Count      int64  `json:"count"`
}

type Chunk struct {
	ChunkID   int64   `json:"chunk_id"`
	Chunk     string  `json:"chunk"`
	URL       string  `json:"url"`
	Title     string  `json:"title"`
	Distance  float64 `json:"distance"`
	IsWin     bool    `json:"is_win"`
	ArticleID int64   `json:"article_id"`
	Count     int64   `json:"count"`
}

type Embedding struct {
	ChunkID  int64
	Vector   []float64
	Distance float64
}

type Stats struct {
	CurrentUsers      int64   `json:"current_users"`
	MeanGuessesPerWin float64 `json:"mean_guesses_per_win"`
}

type SessionUpdate struct {
	Chunks             []Chunk `json:"chunks"`
	Guesses            int64   `json:"guesses"`
	LastGuessArticleID int64   `json:"last_guess_article_id"`
}

func getTargets() []Target {
	targets := make([]Target, 0)

	f, err := os.Open("targets.jsonl")
	if err != nil {
		fmt.Println(err)
		log.Fatal("Could not read targets.")
	}

	r := bufio.NewReader(f)

	for {
		line, err := r.ReadString('\n')
		if err != nil {
			break
		}
		var target Target
		json_err := json.Unmarshal([]byte(line), &target)
		if json_err != nil {
			log.Fatal("Could not read targets row.")
		}

		targets = append(targets, target)
	}

	defer f.Close()

	return targets
}

func getTargetID(targets []Target) int64 {
	now := time.Now().Unix()
	now_et := now - (3600 * 4)
	idx := int64(now_et/(3600*24)) - 20288
	return targets[idx].ArticleID
}

func openDB(dbPath string) (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"file:%s?_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=busy_timeout(5000)&_txlock=immediate",
		dbPath,
	)

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	return db, nil
}

func setHeaders(w http.ResponseWriter, cors_uri string) {
	w.Header().Set("Access-Control-Allow-Origin", cors_uri)
	w.Header().Set("Content-Type", "application/json")
}

func isValidSession(db *sql.DB, session_id string) bool {
	var duplicated int
	err := db.QueryRow(`
		select 1
		from sessions
		where session_id = ?
	`, session_id).Scan(&duplicated)
	return err == nil
}

func enforceValidSession(w http.ResponseWriter, r *http.Request, db *sql.DB) bool {
	session_id := r.URL.Query().Get("session_id")
	if session_id == "" {
		http.Error(w, "Invalid session_id.", http.StatusBadRequest)
		return false
	}
	if !isValidSession(db, session_id) {
		http.Error(w, "Invalid session_id.", http.StatusBadRequest)
		return false
	}
	return true
}

func suggestion(w http.ResponseWriter, r *http.Request, articles []Article, max_suggestions int64) {
	q := r.URL.Query().Get("q")
	clean_q := strings.TrimSpace(strings.ToLower(q))
	if clean_q == "" {
		http.Error(w, "Empty query.", http.StatusBadRequest)
		return
	}

	limit := r.URL.Query().Get("limit")
	num_limit, err := strconv.Atoi(limit)
	if err != nil || num_limit <= 0 {
		http.Error(w, "Invalid limit.", http.StatusBadRequest)
		return
	}
	if int64(num_limit) > max_suggestions {
		http.Error(w, "Exceeded max limit.", http.StatusBadRequest)
		return
	}

	suggestions := getSuggestions(articles, clean_q, int64(num_limit))

	json.NewEncoder(w).Encode(suggestions)
}

func startSession(w http.ResponseWriter, db *sql.DB) {
	id := uuid.New()
	err := logSession(db, id)
	if err != nil {
		http.Error(w, "could not create a session id", http.StatusInternalServerError)
	}
	json.NewEncoder(w).Encode(id)
}

func guessArticle(w http.ResponseWriter, r *http.Request, db *sql.DB, targets []Target, max_chunks int64) {
	target_id := getTargetID(targets)

	raw_guess_id := r.URL.Query().Get("article_id")
	clean_guess_id := strings.TrimSpace(strings.ToLower(raw_guess_id))
	guess_id, err := strconv.Atoi(clean_guess_id)
	if err != nil || guess_id <= 0 {
		http.Error(w, "Invalid article_id.", http.StatusBadRequest)
		return
	}

	session_id := r.URL.Query().Get("session_id")
	if session_id == "" {
		http.Error(w, "Invalid session_id.", http.StatusBadRequest)
		return
	}

	chunks, err := getTopScoredChunks(db, int64(guess_id), target_id, max_chunks)
	if err != nil {
		http.Error(w, "Internal server error.", http.StatusInternalServerError)
		return
	}

	repeat_guess := isDuplicateGuess(db, int64(guess_id), session_id)
	if !repeat_guess {
		best_chunk_id := chunks[0].ChunkID
		best_chunk_score := chunks[0].Distance
		logGuess(db, int64(guess_id), target_id, best_chunk_id, best_chunk_score, session_id)
	}

	if target_id == int64(guess_id) {
		if err := logWin(db, session_id); err != nil {
			http.Error(w, "Could not log win.", http.StatusInternalServerError)
			return
		}
	}

	n_guesses, err := countGuesses(db, session_id)
	if err != nil {
		http.Error(w, "Could not count guesses.", http.StatusInternalServerError)
		return
	}
	session_update := SessionUpdate{chunks, n_guesses, int64(guess_id)}

	json.NewEncoder(w).Encode(session_update)
}

func stats(w http.ResponseWriter, db *sql.DB, logger *log.Logger) {
	stats, err := getStats(db)
	if err != nil {
		logger.Println(err)
		http.Error(w, "could not get stats", http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(stats)
}

func restoreSession(w http.ResponseWriter, r *http.Request, db *sql.DB, targets []Target, max_chunks int64) {
	target_id := getTargetID(targets)

	session_id := r.URL.Query().Get("session_id")
	if session_id == "" {
		http.Error(w, "Invalid session_id.", http.StatusBadRequest)
		return
	}

	MAX_ARTICLE_IDS := 25
	MAX_CHUNKS := 100
	top_n_guesses, err := topNGuesses(db, session_id, MAX_ARTICLE_IDS)
	if err != nil {
		http.Error(w, "Internal server error.", http.StatusInternalServerError)
		return
	}

	total_chunks := make([]Chunk, 0)
	for idx, guess_id := range top_n_guesses {
		chunks, err := getTopScoredChunks(db, int64(guess_id), target_id, max_chunks)
		if err != nil {
			http.Error(w, "Internal server error.", http.StatusInternalServerError)
			return
		}
		total_chunks = append(total_chunks, chunks...)
		if idx > MAX_CHUNKS {
			break
		}
	}

	n_guesses, err := countGuesses(db, session_id)
	if err != nil {
		http.Error(w, "Could not count guesses.", http.StatusInternalServerError)
		return
	}

	last_guess_article_id, err := getLastGuessArticleID(db, session_id)
	if err != nil {
		http.Error(w, "Could not find last article_id.", http.StatusInternalServerError)
		return
	}

	session_update := SessionUpdate{total_chunks, n_guesses, last_guess_article_id}

	json.NewEncoder(w).Encode(session_update)
}

func topChunks(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	session_id := r.URL.Query().Get("session_id")
	if session_id == "" {
		http.Error(w, "Invalid session_id.", http.StatusBadRequest)
		return
	}

	top_chunks, err := queryTopChunks(db, session_id)
	if err != nil {
		http.Error(w, "could not get top chunks", http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(top_chunks)
}

func main() {
	var MAX_SUGGESTIONS int64 = 10
	var MAX_CHUNKS int64 = 10
	CORS_URI := "http://127.0.0.1:5500"
	// CORS_URI := "https://paragraphle.com"
	logger := log.Default()

	logger.Println("starting server")

	err := godotenv.Load()
	if err != nil {
		log.Fatal("no .env file found")
	}

	db_path := os.Getenv("DB_PATH")
	db, err := openDB(db_path)

	if err != nil {
		log.Fatal("could not connect to database")
		return
	}

	targets := getTargets()

	articles := loadSuggestions(db)
	logger.Println("creating handlers")

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", CORS_URI)
		http.Error(w, "This is not a valid endpoint.", http.StatusBadRequest)
	})

	http.HandleFunc("/start-session", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(w, CORS_URI)
		startSession(w, db)
	})

	http.HandleFunc("/suggestion", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(w, CORS_URI)
		suggestion(w, r, articles, MAX_SUGGESTIONS)
	})

	http.HandleFunc("/guess-article", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(w, CORS_URI)
		valid := enforceValidSession(w, r, db)
		if !valid {
			return
		}
		guessArticle(w, r, db, targets, MAX_CHUNKS)
	})

	http.HandleFunc("/stats", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(w, CORS_URI)
		valid := enforceValidSession(w, r, db)
		if !valid {
			return
		}
		stats(w, db, logger)
	})

	http.HandleFunc("/restore-session", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(w, CORS_URI)
		valid := enforceValidSession(w, r, db)
		if !valid {
			return
		}
		restoreSession(w, r, db, targets, MAX_CHUNKS)
	})

	http.HandleFunc("/top-chunks", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(w, CORS_URI)
		valid := enforceValidSession(w, r, db)
		if !valid {
			return
		}
		topChunks(w, r, db)
	})

	logger.Println("listening on 8000")
	log.Fatal(http.ListenAndServe(":8000", nil))
}
