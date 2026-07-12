# Paragraphle Pipeline

## Overview

This pipeline scrapes Wikipedia articles for use in the Paragraphle game. 

To run this pipeline:
- Create a virtual environment and install requirements.txt.
- Create a .env file in the pipeline directory, and add your OpenAI API key like API_KEY=secretkey1234.
- Run main.py.

## Module: Setup
- Create tables and indices in a new local SQLite database.

## Module: Scrape
- The scrape module downloads Wikipedia articles and inserts the raw text into a SQLite database.
- It also captures redirects to find the canonical URL for each article.
- These articles are used as options for guesses inside the Paragraphle game.

## Module: Clean Articles
- The clean articles module separates the raw text for each article into chunks, with the goal of forming natural sentences.
- These chunks are used to give hints to the user as they play Paragraphle.

## Module: Embed
- The embed module uses the OpenAI API to embed the chunks from the clean articles module. 
- This enables chunks to be compared and scored against each other as part of the game.