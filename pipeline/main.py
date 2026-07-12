from scrape import scrape
from setup import create_db
import time 
from clean_articles import clean_articles
from embed import embed_chunks

def main():
    create_db()
    scrape()
    clean_articles()
    embed_chunks()


if __name__ == '__main__':
    main()