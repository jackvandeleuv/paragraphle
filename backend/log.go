package main

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func processWin(db *sql.DB, session_id string, target_id int64, guess_id int64) (bool, int64, error) {
	is_win := target_id == guess_id
	if !is_win {
		return false, -1, nil
	}

	err := logWin(db, session_id)
	if err != nil {
		return false, -1, err
	}

	// win_rank, err := getWinRank(db, session_id, target_id)
	// if err != nil {
	// 	return false, -1, err
	// }
	win_rank := int64(55)
	return is_win, win_rank, nil
}

func getTodayEasternTimeStartUnix() (int64, error) {
	et, err := time.LoadLocation("America/New_York")
	if err != nil {
		return -1, err
	}

	time_now := time.Now()
	today_start := time.Date(
		time_now.Year(),
		time_now.Month(),
		time_now.Day(),
		0, 0, 0, 0,
		et,
	).UnixMilli()
	
	return today_start, nil
}

func getTomorrowEasternTimeStartUnix() (int64, error) {
	et, err := time.LoadLocation("America/New_York")
	if err != nil {
		return -1, err
	}

	time_now := time.Now()
	tomorrow := time_now.AddDate(0, 0, 1)
	tomorrow_start := time.Date(
		tomorrow.Year(),
		tomorrow.Month(),
		tomorrow.Day(),
		0, 0, 0, 0,
		et,
	).UnixMilli()

	return tomorrow_start, nil
}

func getWinRank(db *sql.DB, session_id string, target_id int64) (int64, error) {
	today_start, err := getTodayEasternTimeStartUnix()
	if err != nil {
		return -1, err
	}
	tomorrow_start, err := getTomorrowEasternTimeStartUnix()
	if err != nil {
		return -1, err
	}

	var daily_rank int64
	err = db.QueryRow(`
		select daily_rank
		from (
			select
				rank() over (
					order by guesses asc
				) as daily_rank,
				session_id 
			from wins
			where 
				created_timestamp >= ? and
				created_timestamp < ?
		)
		where session_id == ?
	`, today_start, tomorrow_start, session_id).Scan(&daily_rank)	

	return daily_rank, nil
}

func getIsWin(db *sql.DB, session_id string) (bool, error) {
	var exists int
	err := db.QueryRow(`
		select 1
		from wins
		where session_id == ?	
	`, session_id,
	).Scan(&exists)
	is_win := exists == 1
	return is_win, err
}

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

func topNGuesses(db *sql.DB, session_id string, n int) ([]int64, error) {
	rows, err := db.Query(`
		select distinct guess_article_id
		from guesses
		where session_id = ?
		order by best_chunk_score asc
		limit ?
	`, session_id, n)
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
