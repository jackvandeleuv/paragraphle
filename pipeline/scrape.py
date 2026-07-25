import requests
from bs4 import BeautifulSoup
import time 
import json 
import pandas as pd 
import sqlite3
from collections import defaultdict
import os 
import random 
from config import (
    N_BATCHES,
    BATCH_SIZE,
)

start_article_id = 'United_States'

endpoint = 'search/page'
HEADERS = {
    "User-Agent": (
        "ParagraphleBot/1.0 "
        "(https://paragraphle.com/about; info@paragraphle.com) "
    )
}

def make_url(article_id):
    return f"https://en.wikipedia.org/w/rest.php/v1/page/{article_id}/html"

def extract_article_id_from_url(url):
    _, end = url.split('/page/', 1)
    return end.split('/html', 1)[0].strip()

def extract_article_id_from_internal_link(link):
    '''
        Strip common postfixes from the URL slug.
    '''
    link = link.strip('./')
    if '#' in link:
        link, _ = link.split('#', 1)
    return link.strip()

def get_redirect(resp):
    '''
        Some Wikipedia internal links result in redirects.
        Returns the redirect URL if it exists.
    '''
    first_id = None
    final_id = extract_article_id_from_url(resp.url)
    for hist in resp.history:
        first_id = extract_article_id_from_url(hist.url)
    if first_id and final_id != first_id:
        return final_id
    
def fetch_article(article_id, session, blacklist, max_retries=5):
    '''
        Fetch article from the Wikipedia API.
    '''
    url = make_url(article_id)

    for _ in range(max_retries):
        resp = session.get(url, timeout=10)

        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", "5"))
            print(f'waiting {wait} seconds')
            time.sleep(wait)
            continue

        if resp.status_code == 503:
            wait = int(resp.headers.get("Retry-After", "5"))
            print(f'waiting {wait} seconds')
            time.sleep(wait)
            continue

        if resp.status_code == 404:
            print('404 not found!')
            # Log this article_id so it won't be visited again.
            blacklist.add(article_id)
            return None

        resp.raise_for_status()
        return resp

    raise RuntimeError(f"Hit retry limit")

def process_links(soup, article_id, links):
    '''
        Given page HTML, find all the internal Wikipedia links and
        log them to the links dictionary.
    '''
    for elem in soup.find_all('a'):
        href = elem.get('href', None)
        if (
            not href or 
            'external' in elem.get('class', []) or
            'wikidata' in href or
            ':' in href
        ):
            continue

        link = extract_article_id_from_internal_link(href)
        if link == article_id:
            continue
        links[link] += 1

def process_article(session, article_id, links, scraped, blacklist):
    '''
        Retrieve an article using the provided article_id.
        Update the links, scraped, and blacklist datastructures accordingly.
    '''
    try:
        resp = fetch_article(article_id, session, blacklist)
        if not resp:
            return None, None
    except Exception as e:
        print(e)
        blacklist.add(article_id)
        return None, None

    redirect = get_redirect(resp)

    soup = BeautifulSoup(resp.text, features="html.parser")
    process_links(soup, article_id, links)
    body = soup.find('body')
    if not body:
        'No body element in the page!'
        blacklist.add(article_id)
        return None, None 

    scraped[article_id] = {
        'redirect': redirect, 
        'text': body.text,
        'written': False,
    }

def choose_scrape_targets(scraped, links, blacklist, batch_size):
    '''
        Generate a batch of article_ids for scraping. Randomly choose between
        explore and exploit mode. If explore, visit random articles that are
        in our dataset. If exploit, visit the most important articles, as defined
        by the number of links.
    '''
    if len(scraped) == 0:
        return [start_article_id]
    
    if len(links) == 0:
        raise Exception('No links to choose from')
    
    explore = random.random() < .5
    # Randomly pick articles.
    if explore:
        keys = [
            article_id for article_id in links
            if article_id not in scraped and article_id not in blacklist
        ]
        to_scrape = list(set([random.choice(keys) for _ in range(batch_size)]))
        to_scrape = [(article_id, links[article_id]) for article_id in to_scrape]
    # Pick the articles with the highest link count.
    else:
        to_scrape = [
            (article_id, count)
            for article_id, count in links.items()
            if article_id not in scraped and article_id not in blacklist
        ]
        to_scrape = list(sorted(to_scrape, key=lambda x: x[1]))[-batch_size :]

    if len(to_scrape) == 0:
        raise Exception('Could not find article id to scrape')
    
    return [x[0] for x in to_scrape]

def write_cache(scraped, links, blacklist):
    '''
        Write each of the input data structures to disk.
    '''
    to_cache = [
        ('scraped.json', scraped),
        ('links.json', links),
        ('blacklist.json', blacklist),
    ]
    for fname, obj in to_cache:
        with open('data/' + fname, 'w', encoding='utf-8') as file:
            # Set datatypes are not supported.
            if type(obj) == set:
                obj = list(obj)
            json.dump(obj, file)

def get_cached_json(fname, default):
    '''
        Read the JSON object stored at data/<fname>. If fname is not found,
        return the provided default object.
    '''
    if fname not in os.listdir('data'):
        return default
    with open('data/' + fname, 'r', encoding='utf-8') as file:
        json_obj = json.load(file)
        # If needed, restore the data structures as they were before being serialized to disk.
        if fname == 'blacklist.json':
            json_obj = set(json_obj)
        if fname == 'links.json':
            ddict = defaultdict(int)
            for key in json_obj:
                ddict[key] = json_obj[key]
            json_obj = ddict
        return json_obj
    
def purge_scraped(scraped):
    '''
        Reduce the in-memory size of scraped by writing its values out to disk.

        Keep the key (i.e. the article_id) in the scraped dict, as this key will
        still be used to check if we have visited this article before.
    '''
    keys = [
        key for key in scraped 
        if not scraped[key]['written']
    ]
    to_write = []
    for key in keys:
        article = scraped[key]
        to_write.append((key, article['redirect'], article['text']))
        scraped[key] = {
            'written': True,
        }

    write_scraped(to_write)

def write_scraped(to_write):
    conn = sqlite3.Connection('data/local.db')
    try:
        cur = conn.cursor()
        cur.executemany('''
            insert into raw_articles (article_id, redirect, text)
            values (?, ?, ?)
            on conflict (article_id) do
                update set
                    redirect = excluded.redirect,
                    text = excluded.text
        ''', to_write)
        conn.commit()

    finally:
        conn.close()

def scrape():
    '''
        (1) Scrape articles using the article_ids provided by choose_scrape_targets().
        (2) Write the results to disk in batches.
    '''
    start = time.time()

    session = requests.Session()
    session.headers.update(HEADERS)

    scraped = get_cached_json('scraped.json', {})
    links = get_cached_json('links.json', defaultdict(int))
    blacklist = get_cached_json('blacklist.json', set())

    print(f'Loaded: {len(links)} links')
    print(f'Blacklist has {len(blacklist)} articles')
    print(f'Scraped {len(scraped)} articles so far')

    for batch_idx in range(N_BATCHES):
        s = time.time()
        batch = choose_scrape_targets(scraped, links, blacklist, BATCH_SIZE)
        print(f'set up batch {batch_idx} in', round(time.time() - s, 4))
        for article_id in batch:
            if article_id in blacklist:
                continue
            print(article_id)
            process_article(session, article_id, links, scraped, blacklist)
        
        s = time.time()
        purge_scraped(scraped)
        write_cache(scraped, links, blacklist)
        print(f'Wrote cache in: {round(time.time() - s, 2)}s')

    print(f"Time to scrape: {round(time.time() - start, 2)}")
