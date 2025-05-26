package main

import (
	"bufio"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"os"
	"strings"
)

type Revision struct {
	Text string `xml:"text"`
}

type Page struct {
	Title    string   `xml:"title"`
	ID       string   `xml:"id"`
	Revision Revision `xml:"revision"`
}

func loadSelected(path string) (map[string]bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	selected := make(map[string]bool)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			selected[strings.ToLower(line)] = true
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return selected, nil
}

func writeBuffer(pages []string, selected map[string]bool) {
	outFile, err := os.OpenFile("../transformed/data/articles.jsonl", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer outFile.Close()
	for _, p := range pages {
		var page Page
		if err := xml.Unmarshal([]byte(p), &page); err != nil {
			fmt.Println(err)
			continue
		}
		title := strings.TrimSpace(strings.ToLower(page.Title))
		if !selected[title] {
			continue
		}
		text := strings.Join(strings.Fields(page.Revision.Text), " ")
		article := map[string]string{
			"id":    page.ID,
			"title": page.Title,
			"text":  text,
		}
		b, err := json.Marshal(article)
		if err != nil {
			fmt.Println(err)
			continue
		}
		if _, err := outFile.Write(append(b, '\n')); err != nil {
			fmt.Println(err)
		}
	}
}

func parse_articles() {
	selected, err := loadSelected("data/selected.txt")
	if err != nil {
		fmt.Println(err)
		return
	}
	inFile, err := os.Open("D:/wikipedia/enwiki-20241101-pages-articles-multistream.xml/enwiki-20241101-pages-articles-multistream.xml")
	if err != nil {
		fmt.Println(err)
		return
	}
	defer inFile.Close()
	scanner := bufio.NewScanner(inFile)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 25*1024*1024)
	var capture bool
	var builder strings.Builder
	var pages []string
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if trimmed == "<page>" {
			capture = true
		}
		if capture {
			builder.WriteString(line + "\n")
		}
		if trimmed == "</page>" {
			pages = append(pages, builder.String())
			builder.Reset()
			capture = false
			if len(pages) >= 10000 {
				fmt.Println("Writing buffer")
				writeBuffer(pages, selected)
				pages = []string{}
			}
		}
	}
	if len(pages) > 0 {
		fmt.Println("Writing buffer.")
		writeBuffer(pages, selected)
	}
	if err := scanner.Err(); err != nil {
		fmt.Println(err)
	}
}
