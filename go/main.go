package main

import (
	"bufio"
	"compress/bzip2"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"strings"
)

type Page struct {
	Title string `xml:"title"`
	Text  string `xml:"revision>text"`
}

type Result struct {
	Title string   `json:"title"`
	Head  []string `json:"head"`
}

func extract(article string) []string {
	var result []string
	lines := strings.Split(article, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "<") || strings.HasPrefix(line, "{") ||
			strings.HasPrefix(line, "[") || strings.HasPrefix(line, "*") ||
			strings.HasPrefix(line, "|") || strings.HasPrefix(line, "}") ||
			strings.HasPrefix(line, "]") || strings.Contains(line, "<ns0:text") {
			continue
		}
		result = append(result, line)
		if len(result) == 5 {
			break
		}
	}
	return result
}

func processBZ2File(filePath string, outputPath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("error opening file: %w", err)
	}
	defer file.Close()

	reader := bzip2.NewReader(file)
	decoder := xml.NewDecoder(reader)

	var (
		results     []Result
		page        Page
		currentElem string
	)

	decoder.Strict = false // Allow malformed XML

	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			fmt.Printf("Skipping malformed token: %v\n", err)
			continue // Skip malformed tokens
		}

		switch elem := tok.(type) {
		case xml.StartElement:
			currentElem = elem.Name.Local
			if currentElem == "page" {
				page = Page{}
			}
		case xml.EndElement:
			if elem.Name.Local == "page" {
				// if strings.Contains(page.Text, "#REDIRECT") {
				//     continue
				// }
				head := extract(page.Text)
				results = append(results, Result{Title: page.Title, Head: head})
				if len(results) >= 10000 {
					if err := writeResults(outputPath, results); err != nil {
						return err
					}
					results = nil
				}
			}
		case xml.CharData:
			if currentElem == "title" {
				page.Title = strings.TrimSpace(string(elem))
			} else if currentElem == "text" {
				page.Text += string(elem)
			}
		}
	}

	if len(results) > 0 {
		if err := writeResults(outputPath, results); err != nil {
			return err
		}
	}

	return nil
}

func writeResults(outputPath string, results []Result) error {
	outputFile, err := os.OpenFile(outputPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("error opening output file: %w", err)
	}
	defer outputFile.Close()

	writer := bufio.NewWriter(outputFile)
	for _, result := range results {
		data, err := json.Marshal(result)
		if err != nil {
			return fmt.Errorf("error marshalling result: %w", err)
		}
		_, err = writer.WriteString(string(data) + "\n")
		if err != nil {
			return fmt.Errorf("error writing to output file: %w", err)
		}
	}
	fmt.Println("Wrote results!")
	return writer.Flush()
}

func main() {
	filePath := "D:/wikipedia/enwiki-20241101-pages-articles-multistream.xml.bz2"
	outputPath := "output2.jsonl"

	if err := processBZ2File(filePath, outputPath); err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Println("Processing completed successfully!")
	}
}
