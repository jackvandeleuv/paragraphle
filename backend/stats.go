package main

import (
	"database/sql"
	"time"
)

func getStats(db *sql.DB) (Stats, error) {
	now := time.Now().UnixMilli()
	day_start_utc := int64(now/(3600000*24)) * (3600000 * 24)
	day_start_et := day_start_utc + (3600000 * 4)
	current_users_start := now - (60000 * 3)

	stats := Stats{-1, -1}

	rows, err := db.Query(`
		select count(distinct session_id) as current_users
		from guesses
		where created_timestamp >= ?
	`, current_users_start)
	if err != nil {
		return Stats{-1, -1}, err
	}

	for rows.Next() {
		var current_users int64
		if err := rows.Scan(&current_users); err != nil {
			return Stats{-1, -1}, err
		}
		stats.CurrentUsers = current_users
	}

	rows, err = db.Query(`
		select coalesce(avg(guesses), -1) as mean_guesses_per_win
		from wins
		where created_timestamp >= ?
	`, day_start_et)

	if err != nil {
		return Stats{-1, -1}, err
	}

	for rows.Next() {
		var mean_guesses_per_win float64
		if err := rows.Scan(&mean_guesses_per_win); err != nil {
			return Stats{-1, -1}, err
		}
		stats.MeanGuessesPerWin = mean_guesses_per_win
	}

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
		var article_id int64
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
