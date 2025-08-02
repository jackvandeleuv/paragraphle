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
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "Hello, world!")
	})

	http.HandleFunc("/json", func(w http.ResponseWriter, r *http.Request) {
		db, _ := sql.Open("sqlite", "test.db")
		db.Exec("create table hi (integer primary key)")
		// fmt.Println(err)

		q := r.URL.Query().Get("echo")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Message{Text: q})
	})

	log.Fatal(http.ListenAndServe(":8080", nil))
}
