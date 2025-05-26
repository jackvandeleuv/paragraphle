package main

import (
	"bufio"
	"fmt"
	"os"
)

func readLine(line string, start string, end string) []string {
	refs := []string{}
	s := 0
	for {
		if s+len(start) > len(line) || line[s:s+len(start)] == start {
			t_start := s + len(start)
			s = t_start
			for {
				if s+len(end) > len(line) || line[s:s+len(end)] == end {
					break
				}
				s += 1
			}
			if s <= len(line) {
				refs = append(refs, line[t_start:s])
			}
		}

		if s+len(start) > len(line) {
			break
		}
		s += 1
	}
	return refs
}

func writeBuffer(buffer []string) error {
	file, err := os.OpenFile("transformed/links/links.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		panic(err)
	}
	defer file.Close()

	for i := 0; i < len(buffer); i++ {
		if _, err := file.WriteString(buffer[i] + "\n"); err != nil {
			fmt.Println("Could not write value to disk!")
		}
	}

	return nil
}

func process(inputPath string) error {
	file, err := os.Open(inputPath)
	if err != nil {
		return fmt.Errorf("error opening file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	T_START := "[["
	T_END := "]]"

	buffer := []string{}

	for scanner.Scan() {
		line := scanner.Text()
		if len(line) == 0 || len(line) < len(T_START) {
			continue
		}

		buffer = append(buffer, readLine(line, T_START, T_END)...)
		if len(buffer) > 1000000 {
			err = writeBuffer(buffer)
			if err != nil {
				fmt.Println(err)
			}
			buffer = []string{}
		}
	}

	return nil
}

func main() {
	filePath := "D:/wikipedia/enwiki-20241101-pages-articles-multistream.xml/enwiki-20241101-pages-articles-multistream.xml"

	if err := process(filePath); err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Println("Processing completed successfully!")
	}
}
