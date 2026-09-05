package main

import (
	"log"
	"net/http"
)

func genericServerError(w http.ResponseWriter, err error) {
	internal_msg := err.Error()
	log.Println(internal_msg)
	http.Error(w, "internal server error", http.StatusInternalServerError)
}