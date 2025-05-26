package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
)

func cleanLink(link string) string {
	count := strings.Count(link, "|")
	link = strings.ReplaceAll(link, "[[", "")
	if count == 0 {
		return link
	} else if count == 1 {
		if idx := strings.Index(link, "|"); idx != -1 && idx+1 < len(link) {
			return link[idx+1:]
		}
		return ""
	} else {
		return ""
	}
}

func processLinks(text string) string {
	stoken := "[["
	etoken := "]]"
	var clean []string
	stack := []string{}
	link := ""
	inLink := false

	start := 0
	end := len(stoken)
	for end < len(text) {
		substr := text[start:end]
		if substr == stoken {
			stack = append(stack, stoken)
			inLink = true
		}
		if substr == etoken {
			if len(stack) > 0 {
				stack = stack[:len(stack)-1]
			}
			if len(stack) == 0 {
				cleanedLink := cleanLink(link)
				clean = append(clean, cleanedLink)
				link = ""
				inLink = false
			}
		}
		if inLink {
			link += string(text[start])
		} else {
			clean = append(clean, string(text[start]))
		}
		start++
		end++
	}
	result := strings.Join(clean, "")
	result = strings.ReplaceAll(result, "[[", "")
	result = strings.ReplaceAll(result, "]]", "")
	return result
}

func killTag(text, stoken, etoken string) string {
	var clean []string
	stack := []string{}
	inTag := false
	start := 0

	for start+len(etoken) < len(text) {
		if text[start:start+len(stoken)] == stoken {
			stack = append(stack, stoken)
			inTag = true
		}
		if text[start:start+len(etoken)] == etoken {
			if len(stack) > 0 {
				stack = stack[:len(stack)-1]
			}
			if len(stack) == 0 {
				inTag = false
			}
		}
		if !inTag {
			clean = append(clean, string(text[start]))
		}
		start++
	}
	result := strings.Join(clean, "")
	result = strings.ReplaceAll(result, etoken, "")
	return result
}

func cleanText(text string) string {
	text = killTag(text, "{{", "}}")
	text = killTag(text, "<ref", "</ref>")
	text = processLinks(text)
	words := strings.Fields(text)
	if len(words) > 200 {
		words = words[:200]
	}
	return strings.Join(words, " ")
}

func main() {
	inputFile, err := os.Open("data/articles.jsonl")
	if err != nil {
		log.Fatalf("Error opening input file: %v", err)
	}
	defer inputFile.Close()

	scanner := bufio.NewScanner(inputFile)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 25*1024*1024)

	var data []map[string]interface{}
	count := 0

	for scanner.Scan() {
		line := scanner.Text()

		if strings.Contains(strings.ToUpper(line), "#REDIRECT") {
			continue
		}

		var entry map[string]interface{}
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			log.Printf("Error parsing JSON: %v", err)
			continue
		}

		if title, ok := entry["title"].(string); ok {
			entry["lower_title"] = strings.ToLower(strings.TrimSpace(title))
		}
		data = append(data, entry)
		count++
		if count%100000 == 0 {
			fmt.Printf("Processed %d entries\n", count)
		}
	}
	if err := scanner.Err(); err != nil {
		log.Fatalf("Error reading input file: %v", err)
	}
	fmt.Printf("Total entries: %d\n", len(data))

	for i, entry := range data {
		title, okTitle := entry["title"].(string)
		text, okText := entry["text"].(string)
		if okTitle && okText {
			entry["clean_text"] = fmt.Sprintf("%s: %s", title, cleanText(text))
		}
		if i%1000 == 0 {
			fmt.Printf("Processed %d entries for clean_text\n", i)
		}
	}

	outputFile, err := os.OpenFile("../stable/data/cleaned.jsonl", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatalf("Error opening output file: %v", err)
	}
	defer outputFile.Close()

	writer := bufio.NewWriter(outputFile)
	for _, entry := range data {
		delete(entry, "text")
		jsonBytes, err := json.Marshal(entry)
		if err != nil {
			log.Printf("Error marshaling JSON: %v", err)
			continue
		}
		writer.WriteString(string(jsonBytes) + "\n")
	}
	writer.Flush()
}
