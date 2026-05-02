package main

import (
	"database/sql"
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"sort"
)

func blobToFloat(b []byte) ([]float64, error) {
	if len(b)%4 != 0 {
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	n := len(b) / 4
	out := make([]float64, n)
	for i := 0; i < n; i++ {
		u := binary.LittleEndian.Uint32(b[4*i:])
		out[i] = float64(math.Float32frombits(u))
	}
	return out, nil
}

func embeddingsToChunks(db *sql.DB, embeddings []Embedding, article_id string, is_win bool, logger log.Logger) ([]Chunk, error) {
	rows, err := db.Query(`
		select
			id as chunk_id,
			sentence as chunk,
			article_id as url,
			coalesce(summaries.title, sentences.article_id) as title
		from sentences
		left join summaries
			on sentences.article_id == summaries.article_id
		where article_id = ?
	`, article_id)

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

		logger.Println(chunk_id)
		logger.Println(chunk)
		logger.Println(url)
		logger.Println(title)

		chunks = append(chunks, Chunk{chunk_id, chunk, url, title, embeddings[i].Distance, is_win, "", -1})
		i++
	}
	return chunks, nil
}

func getEmbeddings(db *sql.DB, article_id string, logger log.Logger) ([]Embedding, error) {
	logger.Println("getting embedding with:")
	logger.Println(article_id)

	// TODO: This join to get article_id is only necessary because of an
	// outdated DB schema I will fix. Embeddings will have article_id.
	rows, err := db.Query(`
		select 
			sentence_id as chunk_id, 
			embedding as vector
		from embeddings
		join sentences
			on embeddings.sentence_id == sentences.id
		where sentences.article_id = ?
	`, article_id)
	if err != nil {
		logger.Println(err)
		return nil, fmt.Errorf("could not decode vector from blob storage")
	}
	defer rows.Close()

	embeddings := make([]Embedding, 0)
	for rows.Next() {
		// logger.Println("reading a row...")
		var chunk_id int64
		var blob []byte

		if err := rows.Scan(&chunk_id, &blob); err != nil {
			logger.Println(err)
			return nil, fmt.Errorf("could not decode vector from blob storage")
		}

		vector, err := blobToFloat(blob)

		if err != nil {
			logger.Println(err)
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
		targetVector = append(
			targetVector,
			sum/float64(len(targetChunks)),
		)
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

func scoreArticleID(db *sql.DB, guess_id string, target_id string, logger log.Logger) ([]Embedding, error) {
	logger.Println("getting guess embeddings...")
	guessEmbeddings, err := getEmbeddings(db, guess_id, logger)
	if err != nil {
		return nil, fmt.Errorf("could not get guess chunks")
	}

	logger.Println("getting target embeddings...")
	targetEmbeddings, err := getEmbeddings(db, target_id, logger)
	if err != nil {
		return nil, fmt.Errorf("could not get target chunks")
	}

	logger.Println("got both embeddings")
	logger.Println("\n\n\nguess embedding:")
	logger.Println(guessEmbeddings)
	logger.Println("\n\n\ntarget embedding:")
	logger.Println(targetEmbeddings)

	targetVec := averageTargetVec(targetEmbeddings)

	logger.Println("averaging target vec")

	for i := range guessEmbeddings {
		logger.Println("\n\nscoring vector:")
		logger.Println("ith guess vector:")
		logger.Println(guessEmbeddings[i].Vector)
		logger.Println("target vec:")
		logger.Println(targetVec)
		guessEmbeddings[i].Distance = 1 - cosineSimilarity(guessEmbeddings[i].Vector, targetVec)
	}

	sort.Slice(guessEmbeddings, func(i, j int) bool {
		return guessEmbeddings[i].Distance < guessEmbeddings[j].Distance
	})

	for i := range guessEmbeddings {
		guessEmbeddings[i].Vector = nil
	}

	logger.Println("finish scoring article id")

	return guessEmbeddings, nil
}

func getTopScoredChunks(db *sql.DB, guess_id string, target_id string, max_chunks int64, logger log.Logger) ([]Chunk, error) {
	scoredEmbeddings, err := scoreArticleID(db, guess_id, target_id, logger)
	if err != nil {
		return nil, err
	}
	if len(scoredEmbeddings) == 0 {
		logger.Println("err: length of scored embedding is zero")
		return nil, fmt.Errorf("found no embeddings for article")
	}
	logger.Println("scorred article id")

	if len(scoredEmbeddings) > int(max_chunks) {
		scoredEmbeddings = scoredEmbeddings[:max_chunks]
	}

	chunks, err := embeddingsToChunks(
		db,
		scoredEmbeddings,
		guess_id,
		guess_id == target_id,
		logger,
	)
	if err != nil {
		logger.Println(err)
		return nil, err
	}
	if len(chunks) == 0 {
		return nil, fmt.Errorf("found no chunks for article")
	}

	return chunks, nil
}

func isDuplicateGuess(db *sql.DB, guess_id string, session_id string) bool {
	var duplicated int
	err := db.QueryRow(`
		select 1
		from guesses
		where session_id = ? and guess_article_id = ?
	`, session_id, guess_id).Scan(&duplicated)
	return err == nil
}

func getLastGuessArticleID(db *sql.DB, session_id string) (string, error) {
	rows, err := db.Query(`
		select guess_id
		from guesses
		where session_id = ?
		order by created_timestamp desc
		limit 1
	`, session_id)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var article_id string
	article_id = ""
	for rows.Next() {
		if err := rows.Scan(&article_id); err != nil {
			return "", err
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
