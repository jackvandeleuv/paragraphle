package main

import (
	"database/sql"
	"log"
	"sort"
)

func loadSuggestions(db *sql.DB) []Article {
	rows, err := db.Query("select article_id, title, clean_title, count from articles")
	if err != nil {
		log.Fatal(err)
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
