import requests
from bs4 import BeautifulSoup
import time 
import random
# from score import chunk_to_vec, cosine_similarity
import json 
import pandas as pd 
import sqlite3
from collections import defaultdict

start_article_id = 'American_Greetings'

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
    link = link.strip('./')
    if '#' in link:
        link, _ = link.split('#', 1)
    return link.strip()

def get_redirect(resp):
    first_id = None
    final_id = extract_article_id_from_url(resp.url)
    for hist in resp.history:
        first_id = extract_article_id_from_url(hist.url)
    if first_id and final_id != first_id:
        return final_id
    
def fetch_article(article_id, session, blacklist, max_retries=5) -> str:
    url = make_url(article_id)

    for _ in range(max_retries):
        resp = session.get(url, timeout=10)
        # print(resp.request.headers)

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
            blacklist.add(article_id)
            return None

        resp.raise_for_status()
        return resp

    raise RuntimeError(f"Hit retry limit")

def process_article(session, article_id, links, scraped, blacklist):
    resp = fetch_article(article_id, session, blacklist)
    if not resp:
        return None, None

    redirect = get_redirect(resp)
    # if redirect:
    #     redirects.add((article_id, redirect))

    soup = BeautifulSoup(resp.text, features="html.parser")
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
        links[link] += 1

    scraped[article_id] = {'redirect': redirect, 'html': resp.text}

def upsert_links(links):
    conn = sqlite3.Connection('data/local.db')
    df = (pd
        .DataFrame(links)
        .drop_duplicates()
        .groupby('target_article_id')
        .size()
        .reset_index()
        .rename(columns={0: 'count'})
    )
    try:
        df.to_sql('links', conn, index=False, if_exists='replace')
        conn.commit()
    finally:
        conn.close()

def choose_scrape_targets(scraped, links, blacklist, batch_size):
    if len(scraped) == 0:
        return [start_article_id]
    
    if len(links) == 0:
        raise Exception('No links to choose from')
    
    to_scrape = [
        (article_id, count)
        for article_id, count in links.items()
        if article_id not in scraped and article_id not in blacklist
    ]
    to_scrape = list(sorted(to_scrape, key=lambda x: x[1]))[-batch_size :]

    if len(to_scrape) == 0:
        raise Exception('Could not find article id to scrape')
    
    return [x[0] for x in to_scrape]
    
def upsert_text(article_id, text, redirect, conn):
    (pd.
        DataFrame([{
            'article_id': article_id, 
            'redirect': redirect, 
            'html': text,
        }])
        .to_sql('articles', conn, index=False, if_exists='replace')
    )
    conn.commit()

def upsert_links(links, conn):
    (pd.
        DataFrame(links)
        .to_sql('links', conn, index=False, if_exists='replace')
    )
    conn.commit()
    
def upsert(article_id, text, links, redirect):
    conn = sqlite3.Connection('data/local.db')
    try:
        upsert_text(article_id, text, redirect, conn)
        upsert_links(links, conn)
    finally:
        conn.close()

def write_out(dictionary, fname):
    with open(fname, 'w', encoding='utf-8') as file:
        json.dump(dictionary, file)

def scrape(n_batches, batch_size):
    session = requests.Session()
    session.headers.update(HEADERS)

    scraped = {}
    links = defaultdict(int)
    blacklist = set()

    for batch_idx in range(n_batches):
        s = time.time()
        batch = choose_scrape_targets(scraped, links, blacklist, batch_size)
        print(f'got batch {batch_idx} in', round(time.time() - s, 4))

        for article_id in batch:
            if article_id in blacklist:
                continue
            # print(article_id)
            process_article(session, article_id, links, scraped, blacklist)

    write_out(links, 'links.json')
    write_out(scraped, 'scraped.json')


# def main():
#     session = requests.Session()
#     session.headers.update(headers)

#     redirects = set()
#     texts = {}
#     links = set()

#     pages = []
#     with open('pages.txt', 'r') as file:
#         for line in file:
#             pages.append(json.loads(line.strip()))
    
#     for i, page in enumerate(pages):
#         print(page['url'])
#         article_id = page['url'].replace('https://en.wikipedia.org/wiki/', '').strip()
#         text, new_links = process_article(session, article_id, redirects)
#         while new_links:
#             links.add(new_links.pop())
#         if text is None:
#             continue
#         texts[article_id] = text

#         if i % 1000 == 0:
#             write_out(redirects, texts, links)
#             redirects = set()
#             texts = {}
#             links = set()

#     write_out(redirects, texts, links)

