package main

import (
	"database/sql"
	"fmt"
)

func sessionHasWin(session_id string, db *sql.DB) bool {
	var haswin int
	db.QueryRow(`
		select 1
		from sessions
		where 
			session_id = ? and 
			is give_up
	`, session_id).Scan(&haswin)
	return haswin == 1 
}


// func sessionHasGiveup(w http.ResponseWriter, db *sql.DB, logger *log.Logger) {}



func giveUp(session_id string, db *sql.DB) {
	// How do we indicate that we are giving up?
	// There needs to be a giveup table.
	var haswin = sessionHasWin(session_id, db)
	fmt.Println(haswin)
}
