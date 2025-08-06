package main

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"

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

func getTargets() []Target {
	targets := make([]Target, 0)

	f, err := os.Open("../targets.jsonl")
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

func getSuggestions(articles []Article, prefix string, limit int) []Article {
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
	articles_out := make([]Article, 0)
	for i < len(articles_slice) {
		article := articles_slice[i]
		if article.CleanTitle == prefix {
			article.Count = 100000
		}
		articles_out = append(articles_out, article)
		i += 1
	}

	sort.Slice(articles_out, func(i, j int) bool {
		return articles_out[j].Count < articles_out[i].Count
	})

	if len(articles_out) < limit {
		return articles_out
	}
	return articles_out[:limit]
}

func suggestionsToCache() []string {
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

func makeSuggestionCache(toCache []string, articles []Article) map[string][]Article {
	cache := make(map[string][]Article, len(toCache))

	for _, key := range toCache {
		cache[key] = getSuggestions(articles, key, 10)
	}
	return cache
}

func main() {
	db, err := sql.Open("sqlite", "../data.db")
	if err != nil {
		fmt.Println("Could not connect to database.")
		return
	}

	// targets := getTargets()
	articles := loadSuggestions(db)
	suggestionCache := makeSuggestionCache(suggestionsToCache(), articles)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "This is not a valid endpoint.", http.StatusBadRequest)
	})

	http.HandleFunc("/suggestion", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5500")

		q := r.URL.Query().Get("q")
		clean_q := strings.TrimSpace(strings.ToLower(q))

		limit := r.URL.Query().Get("limit")
		num_limit, err := strconv.Atoi(limit)
		if err != nil || num_limit <= 0 {
			http.Error(w, "Invalid limit.", http.StatusBadRequest)
			return
		}

		value, ok := suggestionCache[clean_q]

		var suggestions []Article
		if ok {
			suggestions = value
		} else {
			suggestions = getSuggestions(articles, clean_q, num_limit)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(suggestions)
	})

	log.Fatal(http.ListenAndServe(":8080", nil))
}
