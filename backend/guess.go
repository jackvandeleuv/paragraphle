package main

import (
	"database/sql"
	"encoding/binary"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	f16 "github.com/x448/float16"
)

func blobToFloat(b []byte) ([]float64, error) {
	if len(b)%2 != 0 {
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	n := len(b) / 2
	out := make([]float64, n)
	for i := 0; i < n; i++ {
		u := binary.LittleEndian.Uint16(b[2*i:])
		out[i] = float64(f16.Frombits(u).Float32())
	}
	return out, nil
}

func embeddingsToChunks(db *sql.DB, embeddings []Embedding, article_id int64, is_win bool) ([]Chunk, error) {
	chunk_ids := make([]string, 0)
	for _, embedding := range embeddings {
		chunk_id := strconv.Itoa(int(embedding.ChunkID))
		chunk_ids = append(chunk_ids, chunk_id)
	}
	chunk_id_string := strings.Join(chunk_ids, ",")

	article_id_string := strconv.Itoa(int(article_id))

	query := fmt.Sprintf(`
		select chunk_id, chunk, url, title
		from (
			select chunk_id, chunk, article_id
			from chunks
			where chunk_id in (%s)
		) as c
		join (
			select article_id, url, title
			from articles
			where article_id in (%s)
		) as a
			on c.article_id == a.article_id
	`, chunk_id_string, article_id_string)

	rows, err := db.Query(query)

	if err != nil {
		fmt.Println(err)
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	defer rows.Close()

	chunks := make([]Chunk, 0)
	i := 0
	for rows.Next() {
		var chunk_id int64
		var chunk string
		var url string
		var title string

		if err := rows.Scan(&chunk_id, &chunk, &url, &title); err != nil {
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}
		chunks = append(chunks, Chunk{chunk_id, chunk, url, title, embeddings[i].Distance, is_win, -1, -1})

	}
	return chunks, nil
}

func getEmbeddings(db *sql.DB, article_id int64) ([]Embedding, error) {
	rows, err := db.Query(`
		select chunk_id, vector
		from embeddings
		where article_id = ?
	`, article_id)
	if err != nil {
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	defer rows.Close()

	embeddings := make([]Embedding, 0)
	for rows.Next() {
		var chunk_id int64
		var blob []byte

		if err := rows.Scan(&chunk_id, &blob); err != nil {
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}

		vector, err := blobToFloat(blob)
		if err != nil {
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}

		embeddings = append(embeddings, Embedding{chunk_id, vector, -1.0})
	}

	return embeddings, nil
}

func averageTargetVec(targetChunks []Embedding) []float64 {
	targetVectorSums := make([]float64, 0)
	for _, vec := range targetChunks {
		for i, val := range vec.Vector {
			if len(targetVectorSums) <= i {
				targetVectorSums = append(targetVectorSums, val)
			} else {
				targetVectorSums[i] += val
			}
		}
	}

	targetVector := make([]float64, 0)
	for _, sum := range targetVectorSums {
		targetVector = append(targetVector, sum/float64(len(targetChunks)))
	}

	return targetVector
}

func l2Norm(x []float64) float64 {
	sum := 0.0
	for _, val := range x {
		sum += math.Pow(val, 2)
	}
	return math.Sqrt(sum)
}

func cosineSimilarity(x []float64, y []float64) float64 {
	var innerProduct float64 = 0
	for i := 0; i < len(x); i++ {
		innerProduct += x[i] * y[i]
	}
	x_norm := l2Norm(x)
	y_norm := l2Norm(y)
	return innerProduct / (x_norm * y_norm)
}

func scoreArticleID(db *sql.DB, guess_id int64, target_id int64) ([]Embedding, error) {
	guessEmbeddings, err := getEmbeddings(db, guess_id)
	if err != nil {
		return nil, fmt.Errorf("could not get guess chunks")
	}

	targetEmbeddings, err := getEmbeddings(db, target_id)
	if err != nil {
		return nil, fmt.Errorf("could not get target chunks")
	}

	targetVec := averageTargetVec(targetEmbeddings)

	for i := range guessEmbeddings {
		guessEmbeddings[i].Distance = 1 - cosineSimilarity(guessEmbeddings[i].Vector, targetVec)
	}

	sort.Slice(guessEmbeddings, func(i, j int) bool {
		return guessEmbeddings[i].Distance < guessEmbeddings[j].Distance
	})

	for i := range guessEmbeddings {
		guessEmbeddings[i].Vector = nil
	}

	return guessEmbeddings, nil
}

func getTopScoredChunks(db *sql.DB, guess_id int64, target_id int64, max_chunks int64) ([]Chunk, error) {
	scoredEmbeddings, err := scoreArticleID(db, int64(guess_id), target_id)
	if err != nil {
		return nil, err
	}
	if len(scoredEmbeddings) == 0 {
		return nil, fmt.Errorf("found no embeddings for article")
	}

	if len(scoredEmbeddings) > int(max_chunks) {
		scoredEmbeddings = scoredEmbeddings[:max_chunks]
	}

	chunks, err := embeddingsToChunks(
		db,
		scoredEmbeddings,
		int64(guess_id),
		int64(guess_id) == target_id,
	)
	if err != nil {
		return nil, err
	}
	if len(chunks) == 0 {
		return nil, fmt.Errorf("found no chunks for article")
	}

	return chunks, nil
}

func isDuplicateGuess(db *sql.DB, guess_id int64, session_id string) bool {
	var duplicated int
	err := db.QueryRow(`
		select 1
		from guesses
		where session_id = ? and guess_article_id = ?
	`, session_id, guess_id).Scan(&duplicated)
	return err == nil
}

func getLastGuessArticleID(db *sql.DB, session_id string) (int64, error) {
	rows, err := db.Query(`
		select guess_id
		from guesses
		where session_id = ?
		order by created_timestamp desc
		limit 1
	`, session_id)
	if err != nil {
		return -1, err
	}
	defer rows.Close()

	var article_id int64
	article_id = -1
	for rows.Next() {
		if err := rows.Scan(&article_id); err != nil {
			return -1, err
		}
	}
	return article_id, nil
}

func countGuesses(db *sql.DB, session_id string) (int64, error) {
	rows, err := db.Query(`
		select count(guess_id)
		from guesses
		where session_id = ?
	`, session_id)
	if err != nil {
		return -1, err
	}
	defer rows.Close()

	var count int64
	for rows.Next() {
		if err := rows.Scan(&count); err != nil {
			return -1, err
		}
	}
	return count, nil
}
