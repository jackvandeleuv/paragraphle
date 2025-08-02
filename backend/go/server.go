package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	_ "modernc.org/sqlite"
)

type Message struct {
	Text string `json:"text"`
}

func hi() string {
	return "hey hi"
}

func main() {
	db, err := sql.Open("sqlite", "../data.db")
	if err != nil {
		fmt.Println("Could not connect to database.")
		return
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "Hi!")
	})

	http.HandleFunc("/guess", func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("select article_id from articles limit 1")
		if err != nil {
			fmt.Println(err)
		}
		defer rows.Close()

		ids := make([]string, 0)
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				log.Fatal(err)
			}
			ids = append(ids, id)
		}

		fmt.Println(ids)

		// q := r.URL.Query().Get("echo")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Message{Text: "test"})
	})

	log.Fatal(http.ListenAndServe(":8080", nil))
}
