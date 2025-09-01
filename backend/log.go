package main

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func logWin(db *sql.DB, session_id string) error {
	created := time.Now().UnixMilli()
	_, err := db.Exec(`
		insert into wins (
			created_timestamp,
			session_id,
			guesses
		) values (
			?, 
			?,
			(
				select coalesce(count(guess_id), 1) 
				from guesses 
				where session_id == ?
			)
		)
	`, created, session_id, session_id,
	)
	if err != nil {
		fmt.Println(err)
		return err
	}
	return nil
}

func logGuess(
	db *sql.DB,
	guess_article_id int64,
	target_article_id int64,
	best_chunk_id int64,
	best_chunk_score float64,
	session_id string,
) error {
	created := time.Now().UnixMilli()
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
		return fmt.Errorf("could not decode vector from blob storage")
	}
	return nil
}

func logSession(db *sql.DB, session_id uuid.UUID) error {
	created := time.Now().UnixMilli()
	_, err := db.Exec(`
		insert into sessions (
			created_timestamp,
			session_id
		) values (?, ?)
	`, created, session_id,
	)
	if err != nil {
		return err
	}
	return nil
}

func topNGuesses(db *sql.DB, session_id string) ([]int64, error) {
	rows, err := db.Query(`
		select distinct guess_article_id
		from guesses
		where session_id = ?
		order by best_chunk_score asc
		limit 100
	`, session_id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	article_ids := make([]int64, 0)
	for rows.Next() {
		var article_id int64
		if err := rows.Scan(&article_id); err != nil {
			return nil, err
		}
		article_ids = append(article_ids, article_id)
	}
	return article_ids, nil
}
