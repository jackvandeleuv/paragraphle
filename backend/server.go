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
	ChunkID  int64   `json:"chunk_id"`
	Chunk    string  `json:"chunk"`
	URL      string  `json:"url"`
	Title    string  `json:"title"`
	Distance float64 `json:"distance"`
	IsWin    bool    `json:"is_win"`
}

type Embedding struct {
	ChunkID  int64
	Vector   []float64
	Distance float64
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

func logGuess(
	db *sql.DB,
	guess_article_id int64,
	target_article_id int64,
	best_chunk_id int64,
	best_chunk_score float64,
	session_id string,
) {
	created := time.Now().Unix()
	_, err := db.Exec(`
		insert into guesses (
			created_timestamp,
			guess_article_id,
			target_article_id,
			best_chunk_id,
			best_chunk_score,
			session_id
		) values (
			?, ?, ?,
			?, ?, ?
		)
	`, created, guess_article_id, target_article_id,
		best_chunk_id, best_chunk_score, session_id,
	)
	if err != nil {
		log.Fatal(err)
	}
}

func embeddingsToChunks(db *sql.DB, embeddings []Embedding, article_id int64, is_win bool) ([]Chunk, error) {
	chunk_ids := make([]string, 0)
	for _, embedding := range embeddings {
		chunk_id := strconv.Itoa(int(embedding.ChunkID))
		chunk_ids = append(chunk_ids, chunk_id)
	}
	chunk_id_string := strings.Join(chunk_ids, ",")

	article_id_string := strconv.Itoa(int(article_id))

	query := fmt.Sprintf(`
		select chunk_id, chunk, url, title
		from (
			select chunk_id, chunk, article_id
			from chunks
			where chunk_id in (%s)
		) as c
		join (
			select article_id, url, title
			from articles
			where article_id in (%s)
		) as a
			on c.article_id == a.article_id
	`, chunk_id_string, article_id_string)
	fmt.Println(query)

	rows, err := db.Query(query)

	if err != nil {
		fmt.Println(err)
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	defer rows.Close()

	chunks := make([]Chunk, 0)
	i := 0
	for rows.Next() {
		var chunk_id int64
		var chunk string
		var url string
		var title string

		if err := rows.Scan(&chunk_id, &chunk, &url, &title); err != nil {
			fmt.Println("no decode")
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}
		chunks = append(chunks, Chunk{chunk_id, chunk, url, title, embeddings[i].Distance, is_win})

	}
	return chunks, nil
}

func getEmbeddings(db *sql.DB, article_id int64) ([]Embedding, error) {
	rows, err := db.Query(`
		select chunk_id, vector
		from embeddings
		where article_id = ?
	`, article_id)
	fmt.Println("queried")
	if err != nil {
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	defer rows.Close()

	embeddings := make([]Embedding, 0)
	for rows.Next() {
		var chunk_id int64
		var blob []byte

		if err := rows.Scan(&chunk_id, &blob); err != nil {
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}

		vector, err := blobToFloat(blob)
		if err != nil {
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}

		embeddings = append(embeddings, Embedding{chunk_id, vector, -1.0})
	}

	return embeddings, nil
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

func binarySearch(articles []Article, target string) int {
	left := 0
	right := len(articles)
	mid := ((right - left) / 2) + left
	size := len(target)

	for left < right {
		mid_slice := len(articles[mid].CleanTitle)
		if mid_slice > size {
			mid_slice = size
		}
		if target == articles[mid].CleanTitle[:mid_slice] {
			return mid
		} else if target < articles[mid].CleanTitle[:mid_slice] {
			right = mid
			mid = ((right - left) / 2) + left
		} else {
			left = mid + 1
			mid = ((right - left) / 2) + left
		}
	}
	return -1
}

func getSuggestions(articles []Article, prefix string, limit int64) []Article {
	size := len(prefix)
	mid := binarySearch(articles, prefix)

	if mid == -1 {
		return make([]Article, 0)
	}

	left := mid
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
	right := mid
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

func averageTargetVec(targetChunks []Embedding) []float64 {
	targetVectorSums := make([]float64, 0)
	for _, vec := range targetChunks {
		for i, val := range vec.Vector {
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

func scoreArticleID(db *sql.DB, guess_id int64, target_id int64) ([]Embedding, error) {
	guessEmbeddings, err := getEmbeddings(db, guess_id)
	if err != nil {
		return nil, fmt.Errorf("could not get guess chunks")
	}
	fmt.Println("guess embeddings")

	targetEmbeddings, err := getEmbeddings(db, target_id)
	if err != nil {
		return nil, fmt.Errorf("could not get target chunks")
	}
	fmt.Println("here")

	targetVec := averageTargetVec(targetEmbeddings)

	for i := range guessEmbeddings {
		guessEmbeddings[i].Distance = 1 - cosineSimilarity(guessEmbeddings[i].Vector, targetVec)
	}

	sort.Slice(guessEmbeddings, func(i, j int) bool {
		return guessEmbeddings[i].Distance < guessEmbeddings[j].Distance
	})

	for i := range guessEmbeddings {
		guessEmbeddings[i].Vector = nil
	}

	return guessEmbeddings, nil
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
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5500")
		// w.Header().Set("Access-Control-Allow-Origin", "https://paragraphle.com")

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
		if int64(num_limit) > MAX_SUGGESTIONS {
			http.Error(w, "Exceeded max limit.", http.StatusBadRequest)
			return
		}

		suggestions := getSuggestions(articles, clean_q, int64(num_limit))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(suggestions)
	})

	http.HandleFunc("/guess-article", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5500")
		// w.Header().Set("Access-Control-Allow-Origin", "https://paragraphle.com")

		target_id := getTargetID(targets)

		raw_guess_id := r.URL.Query().Get("article_id")
		clean_guess_id := strings.TrimSpace(strings.ToLower(raw_guess_id))
		guess_id, err := strconv.Atoi(clean_guess_id)
		if err != nil || guess_id <= 0 {
			http.Error(w, "Invalid article_id.", http.StatusBadRequest)
			return
		}

		session_id := r.URL.Query().Get("session_id")

		scoredEmbeddings, err := scoreArticleID(db, int64(guess_id), target_id)
		if err != nil {
			http.Error(w, "Invalid article_id.", http.StatusBadRequest)
			return
		}

		if len(scoredEmbeddings) > int(MAX_CHUNKS) {
			scoredEmbeddings = scoredEmbeddings[:MAX_CHUNKS]
		}

		var best_chunk_id int64
		var best_chunk_score float64
		if len(scoredEmbeddings) == 0 {
			best_chunk_id = -1
			best_chunk_score = -1.0
		} else {
			best_chunk_id = scoredEmbeddings[0].ChunkID
			best_chunk_score = scoredEmbeddings[0].Distance
		}

		logGuess(db, int64(guess_id), target_id, best_chunk_id, best_chunk_score, session_id)

		chunks, err := embeddingsToChunks(
			db,
			scoredEmbeddings,
			int64(guess_id),
			int64(guess_id) == target_id,
		)
		if err != nil {
			http.Error(w, "Could not load chunk text.", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(chunks)
	})

	log.Fatal(http.ListenAndServe(":8000", nil))
}
