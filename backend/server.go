package main

import (
	"bufio"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	f16 "github.com/x448/float16"
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
	ChunkID  int64     `json:"chunk_id"`
	Chunk    string    `json:"chunk"`
	URL      string    `json:"url"`
	Title    string    `json:"title"`
	Distance float64   `json:"distance"`
	Vector   []float64 `json:"vector,omitempty"`
	IsWin    bool      `json:"is_win"`
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

func blobToFloat(b []byte) ([]float64, error) {
	if len(b)%2 != 0 {
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	n := len(b) / 2
	out := make([]float64, n)
	for i := 0; i < n; i++ {
		u := binary.LittleEndian.Uint16(b[2*i:])
		out[i] = float64(f16.Frombits(u).Float32())
	}
	return out, nil
}

func getChunks(db *sql.DB, article_id int64, is_win bool) ([]Chunk, error) {
	rows, err := db.Query(`
        select c.chunk_id, chunk, url, title, vector
        from (
            select chunk_id, chunk, article_id
            from chunks
            where article_id == ?
        ) as c
        join (
            select article_id, url, title
            from articles
            where article_id == ?    
        ) as a
            on c.article_id == a.article_id
		join (
			select vector, chunk_id
			from embeddings
		) as e
			on c.chunk_id == e.chunk_id
	`, article_id, article_id)
	if err != nil {
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	defer rows.Close()

	chunks := make([]Chunk, 0)
	for rows.Next() {
		var chunk_id int64
		var chunk string
		var url string
		var title string
		var blob []byte

		if err := rows.Scan(&chunk_id, &chunk, &url, &title, &blob); err != nil {
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}

		vector, err := blobToFloat(blob)
		if err != nil {
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}

		chunks = append(chunks, Chunk{chunk_id, chunk, url, title, -1.0, vector, is_win})
	}

	return chunks, nil
}

func loadSuggestions(db *sql.DB) []Article {
	rows, err := db.Query("select article_id, title, clean_title, count from articles")
	if err != nil {
		fmt.Println(err)
	}
	defer rows.Close()

	articles := make([]Article, 0)
	for rows.Next() {
		var article_id int64
		var title string
		var clean_title string
		var count int64

		if err := rows.Scan(&article_id, &title, &clean_title, &count); err != nil {
			log.Fatal(err)
		}
		articles = append(articles, Article{article_id, title, clean_title, count})
	}

	sort.Slice(articles, func(i, j int) bool {
		return articles[i].CleanTitle < articles[j].CleanTitle
	})

	return articles
}

func getSuggestions(articles []Article, prefix string, limit int64) []Article {
	left := 0
	right := len(articles)
	mid := ((right - left) / 2) + left
	size := len(prefix)

	found := false
	for left < right {
		mid_slice := len(articles[mid].CleanTitle)
		if mid_slice > size {
			mid_slice = size
		}
		if prefix == articles[mid].CleanTitle[:mid_slice] {
			found = true
			break
		} else if prefix < articles[mid].CleanTitle[:mid_slice] {
			right = mid
			mid = ((right - left) / 2) + left
		} else {
			left = mid + 1
			mid = ((right - left) / 2) + left
		}
	}

	if !found {
		return make([]Article, 0)
	}

	left = mid
	for 0 <= left {
		left_slice := len(articles[left].CleanTitle)
		if size < left_slice {
			left_slice = size
		}
		if prefix != articles[left].CleanTitle[:left_slice] {
			break
		}
		left -= 1
	}
	left += 1

	// Don't add one to comparisons with right if using slices because it is exclusive
	right = mid
	for right < len(articles) {
		right_slice := len(articles[right].CleanTitle)
		if size < right_slice {
			right_slice = size
		}
		if prefix != articles[right].CleanTitle[:right_slice] {
			break
		}
		right += 1
	}

	if left > right || left > len(articles) {
		return make([]Article, 0)
	}

	articles_slice := articles[left:right]
	i := 0
	full_matches := make([]Article, 0)
	partial_matches := make([]Article, 0)
	for i < len(articles_slice) {
		article := articles_slice[i]
		if article.CleanTitle == prefix {
			full_matches = append(full_matches, article)
		} else {
			partial_matches = append(partial_matches, article)
		}
		i += 1
	}

	sort.Slice(partial_matches, func(i, j int) bool {
		return partial_matches[j].Count < partial_matches[i].Count
	})

	sort.Slice(full_matches, func(i, j int) bool {
		return full_matches[j].Count < full_matches[i].Count
	})

	matches := make([]Article, 0)
	matches = append(matches, full_matches...)
	matches = append(matches, partial_matches...)

	if len(matches) < int(limit) {
		return matches
	}
	return matches[:limit]
}

func suggestionsToCache() []string {
	// Cache all combinations of three letters.
	suggestions := make([]string, 0, 26+26*26+26*26*26)

	for i := byte('a'); i <= 'z'; i++ {
		suggestions = append(suggestions, string(i))

		for j := byte('a'); j <= 'z'; j++ {
			suggestions = append(suggestions, string([]byte{i, j}))

			for k := byte('a'); k <= 'z'; k++ {
				suggestions = append(suggestions, string([]byte{i, j, k}))
			}
		}
	}
	return suggestions
}

func makeSuggestionCache(toCache []string, articles []Article, limit int64) map[string][]Article {
	cache := make(map[string][]Article, len(toCache))

	for _, key := range toCache {
		cache[key] = getSuggestions(articles, key, limit)
	}
	return cache
}

func targetChunksToVec(targetChunks []Chunk) []float64 {
	targetVectorSums := make([]float64, 0)
	for _, chunk := range targetChunks {
		for i, val := range chunk.Vector {
			if len(targetVectorSums) <= i {
				targetVectorSums = append(targetVectorSums, val)
			} else {
				targetVectorSums[i] += val
			}
		}
	}

	targetVector := make([]float64, 0)
	for _, sum := range targetVectorSums {
		targetVector = append(targetVector, sum/float64(len(targetChunks)))
	}

	return targetVector
}

func l2Norm(x []float64) float64 {
	sum := 0.0
	for _, val := range x {
		sum += math.Pow(val, 2)
	}
	return math.Sqrt(sum)
}

func cosineSimilarity(x []float64, y []float64) float64 {
	var innerProduct float64 = 0
	for i := 0; i < len(x); i++ {
		innerProduct += x[i] * y[i]
	}
	x_norm := l2Norm(x)
	y_norm := l2Norm(y)
	return innerProduct / (x_norm * y_norm)
}

func scoreArticleID(db *sql.DB, guess_id int64, target_id int64) ([]Chunk, error) {
	guessChunks, err := getChunks(db, guess_id, guess_id == target_id)
	if err != nil {
		return nil, fmt.Errorf("could not get guess chunks")
	}

	targetChunks, err := getChunks(db, target_id, false)
	if err != nil {
		return nil, fmt.Errorf("could not get target chunks")
	}

	targetVec := targetChunksToVec(targetChunks)

	for i := range guessChunks {
		guessChunks[i].Distance = 1 - cosineSimilarity(guessChunks[i].Vector, targetVec)
	}

	sort.Slice(guessChunks, func(i, j int) bool {
		return guessChunks[i].Distance < guessChunks[j].Distance
	})

	for i := range guessChunks {
		guessChunks[i].Vector = nil
	}

	return guessChunks, nil
}

func getTargetID(targets []Target) int64 {
	now := time.Now().Unix()
	now_et := now - (3600 * 4)
	idx := int64(now_et/(3600*24)) - 20288
	return targets[idx].ArticleID
}

func main() {
	logger := log.Default()

	var MAX_SUGGESTIONS int64 = 30
	var MAX_CHUNKS int64 = 10

	err := godotenv.Load()
	if err != nil {
		log.Fatal("no .env file found")
	}

	db_path := os.Getenv("DB_PATH")
	db, err := sql.Open("sqlite", db_path)
	if err != nil {
		log.Fatal("could not connect to database")
		return
	}
	logger.Println("connected to database")

	targets := getTargets()
	logger.Println("got targets from disk")

	articles := loadSuggestions(db)
	logger.Println("loaded suggestion array")

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "This is not a valid endpoint.", http.StatusBadRequest)
	})

	http.HandleFunc("/suggestion", func(w http.ResponseWriter, r *http.Request) {
		// w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5500")
		w.Header().Set("Access-Control-Allow-Origin", "https://wiki-guess.com")

		q := r.URL.Query().Get("q")
		clean_q := strings.TrimSpace(strings.ToLower(q))

		limit := r.URL.Query().Get("limit")
		num_limit, err := strconv.Atoi(limit)
		if err != nil || num_limit <= 0 {
			http.Error(w, "Invalid limit.", http.StatusBadRequest)
			return
		}
		if int64(num_limit) > MAX_SUGGESTIONS {
			http.Error(w, "Exceeded max limit.", http.StatusBadRequest)
			return
		}

		suggestions := getSuggestions(articles, clean_q, int64(num_limit))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(suggestions)
	})

	http.HandleFunc("/guess-article", func(w http.ResponseWriter, r *http.Request) {
		// w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5500")
		w.Header().Set("Access-Control-Allow-Origin", "https://wiki-guess.com")

		target_id := getTargetID(targets)

		raw_guess_id := r.URL.Query().Get("article_id")
		clean_guess_id := strings.TrimSpace(strings.ToLower(raw_guess_id))
		guess_id, err := strconv.Atoi(clean_guess_id)
		if err != nil || guess_id <= 0 {
			http.Error(w, "Invalid article_id.", http.StatusBadRequest)
			return
		}

		chunks, err := scoreArticleID(db, int64(guess_id), target_id)
		if err != nil {
			http.Error(w, "Invalid article_id.", http.StatusBadRequest)
			return
		}

		if len(chunks) > int(MAX_CHUNKS) {
			chunks = chunks[:MAX_CHUNKS]
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(chunks)
	})

	log.Fatal(http.ListenAndServe(":8000", nil))
}
