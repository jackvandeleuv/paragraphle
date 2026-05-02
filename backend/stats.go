package main

import (
	"database/sql"
	"fmt"
	"time"
)

func getCurrentUserCount(db *sql.DB, window_start int64) int64 {
	var current_users int64

	err := db.QueryRow(`
		select count(distinct session_id) as current_users
		from guesses
		where created_timestamp >= ?
	`, window_start).Scan(&current_users)

	if err != nil {
		fmt.Println(err)
		return -1
	}

	return current_users
}

func getUserStats(db *sql.DB, window_start int64) (int64, int64) {
	var user_count int64
	var guess_count int64

	err := db.QueryRow(`
		select count(distinct session_id) as user_count, count(distinct guess_id) as guess_count
		from guesses
		where created_timestamp >= ?
	`, window_start).Scan(&user_count, &guess_count)

	if err != nil {
		fmt.Println(err)
		return -1, -1
	}

	return user_count, guess_count
}

func getWinStats(db *sql.DB, window_start int64) (int64, float64) {
	var mean_guesses_per_win float64
	var win_count int64

	err := db.QueryRow(`
		select coalesce(avg(guesses), -1) as mean_guesses_per_win, count(*) as win_count
		from wins
		where created_timestamp >= ?
	`, window_start).Scan(&mean_guesses_per_win, &win_count)

	if err != nil {
		fmt.Println(err)
		return -1, -1.0
	}

	return win_count, mean_guesses_per_win
}

func getStats(db *sql.DB) (Stats, error) {
	now := time.Now().UnixMilli()

	day_start, err := time.LoadLocation("America/New_York")
	if err != nil {
		return Stats{-1, -1, -1, -1, -1}, err
	}

	now_et := time.Now().In(day_start)
	startOfDayNY := time.Date(
		now_et.Year(), now_et.Month(), now_et.Day(),
		0, 0, 0, 0, day_start,
	)
	day_start_et := startOfDayNY.UnixMilli()

	three_minutes_ago := now - int64(3*60*1000)
	current_user_count := getCurrentUserCount(db, three_minutes_ago)

	win_count, mean_guesses_per_win := getWinStats(db, day_start_et)
	user_count, guess_count := getUserStats(db, day_start_et)

	stats := Stats{current_user_count, mean_guesses_per_win, win_count, guess_count, user_count}

	return stats, nil
}

func queryTopChunks(db *sql.DB, session_id string) ([]Chunk, error) {
	rows, err := db.Query(`
		select 
			g.best_chunk_id, 
			c.chunk,
			a.url,
			a.title, 
			g.best_chunk_score,
			a.article_id,
			a.count
		from guesses g
		join chunks c
			on g.best_chunk_id == c.chunk_id
		join articles a
			on a.guess_article_id == a.article_id
		where session_id = ?
	`, session_id)
	if err != nil {
		return nil, err
	}

	chunks := make([]Chunk, 0)
	for rows.Next() {
		var best_chunk_id int64
		var chunk_text string
		var url string
		var title string
		var best_chunk_score float64
		var article_id string
		var count int64

		err := rows.Scan(&best_chunk_id, &chunk_text, &url, &title, &best_chunk_score, &article_id, &count)
		if err != nil {
			return nil, err
		}
		chunk := Chunk{best_chunk_id, chunk_text, url, title, best_chunk_score, false, article_id, count}
		chunks = append(chunks, chunk)
	}
	return chunks, nil
}
