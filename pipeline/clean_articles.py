import re
import pandas as pd  
import sqlite3
from bs4 import BeautifulSoup
import json
import hashlib
from config import CHUNK_WORDS_MAX, CHUNK_WORDS_MIN
import time

def clean_sentence(sentence):
    '''
        Remove non-alphanumeric characters and extra whitespace.
    '''
    clean_sentence = sentence.strip().lower()
    clean_sentence = re.sub(r"[^0-9a-zA-Z]+", " ", clean_sentence)
    clean_sentence = re.sub(r"\s\s+", " ", clean_sentence).strip()
    return clean_sentence

def parse_sentence(sentence, sentences, buf, min):
    '''
        Combine a new sentence with the content of the buffer, which 
        is populated when we have tokens from a previous sentence that
        were too few to meet the minimum sentence size requirement.
    '''
    if sentence.strip() == '':
        return
    sentence = re.sub(r"\s\s+", ' ', sentence).strip()
    if not sentence.endswith('.'):
        sentence = sentence + '.'

    if buf:
        sentence = ' '.join(buf) + ' ' + sentence
        buf.clear()

    if sentence.split().__len__() <= min:
        buf.append(sentence)
    else:
        sentences.append(sentence)

def extract_raw_sentences(page, min):
    '''
        Separate the raw text from a Wikipedia page into multiple sentences using periods.
    '''
    buf = []
    sentences = []

    for text in page.split('.'):
        text = text.strip()
        if text == '' or len(text) <= CHUNK_WORDS_MIN:
            continue

        text = re.sub(r"\[\d+\]", ' ', text)

        for sentence in text.split('. '):
            parse_sentence(sentence, sentences, buf, min)

    if buf:
        buf_tokens = sum([len(sent.split()) for sent in buf])
        if buf_tokens >= min:
            sentences.append(' '.join(buf))

    return sentences

def reduce_oversized_sentences(sentences, min, max):
    '''
        In the previous stage, we enforced a minimum sentence size by concatenating
        chunks that were too small. This process likely resulted in some sentences that
        are too large, so we will separate each of these oversized sentences into smaller 
        chunks. This may result in some chunks that are once again too small.
    '''
    out = []
    for sentence in sentences:
        if len(sentence.split()) <= max:
            out.append(sentence)
            continue

        buf = []
        first = True
        for word in sentence.split():
            buf.append(word)
            if len(buf) >= max:
                chunk = ' '.join(buf)
                if first:
                    chunk = chunk + '...'
                else:
                    chunk = '...' + chunk
                first = False
                out.append(chunk)
                buf = []

        if len(buf) >= min:
            out.append('...' + ' '.join(buf))

    out = [string.replace('\n', ' ') for string in out]

    return out

def get_sentences(text):
    '''
        Turn raw text from a Wikipedia page into individual sentences.
    '''
    sentences = extract_raw_sentences(text, CHUNK_WORDS_MIN)
    sentences = reduce_oversized_sentences(sentences, CHUNK_WORDS_MIN, CHUNK_WORDS_MAX)
    return sentences

def get_article_ids_to_chunk():
    conn = sqlite3.Connection('data/local.db')
    try:
        df = pd.read_sql('select article_id from raw_articles', conn)
        return [x['article_id'] for _, x in df.iterrows()]
    finally:
        conn.close()

def get_articles(article_ids, conn):
    bindings = ','.join(['?' for _ in range(len(article_ids))])
    cur = conn.execute(f'''
        select article_id, redirect, text
        from raw_articles
        where article_id in ({bindings})   
    ''', article_ids)
    return [dict(row) for row in cur]

def insert_article(canonical_id, alias_id, link_count, conn):
    cur = conn.cursor()
    cur.execute('''
        insert into articles (article_id, alias, count)
        values (?, ?, ?)
        on conflict (article_id) do 
            update set
                alias = excluded.alias,
                count = excluded.count
    ''', (canonical_id, alias_id, link_count))

def process_article_record(article, links, conn):
    '''
        Insert article into the database. Identifies the canonical URL identifier and
        the count of times this article received internal links from other Wikipedia pages.
    '''

    # Link counts may be stored under the canonical article_id, as well as other 
    # aliases that redirect to it. 
    link_count = 0
    if article.get('redirect', None):
        canonical_id = article['redirect']
        alias_id = article['article_id']
        link_count = links.get(canonical_id, 0) + links.get(alias_id, 0)
    else:
        canonical_id = article['article_id']
        alias_id = None
        link_count = links.get(canonical_id, 0)

    insert_article(canonical_id, alias_id, link_count, conn)

    return canonical_id

def make_hash_id(string):
    return hashlib.sha256(string.encode()).hexdigest()[: 32]

def insert_sentences(canonical_id, sentences, conn):
    params = [
        (make_hash_id(sentence), canonical_id, sentence)
        for sentence in sentences
    ]
    cur = conn.cursor()
    cur.executemany('''
        insert into chunks (chunk_id, article_id, chunk)
        values (?, ?, ?)
        on conflict (chunk_id) do 
            update set 
                article_id = excluded.article_id,
                chunk = excluded.chunk
    ''', params)

def process_article(article, links, conn):
    canonical_id = process_article_record(article, links, conn)
    sentences = get_sentences(article['text'])
    insert_sentences(canonical_id, sentences, conn)

def process_article_batch(article_ids, links):
    conn = sqlite3.Connection('data/local.db')
    conn.row_factory = sqlite3.Row

    try:
        articles = get_articles(article_ids, conn)
        for article in articles:
            process_article(article, links, conn)
        conn.commit()
    finally:
        conn.close()

def read_links():
    with open('data/links.json', 'r', encoding='utf-8') as file:
        return json.load(file)

def clean_articles():
    '''
        Separate raw article text into human-readable chunks.
    '''
    BATCH_SIZE = 100
    article_ids = get_article_ids_to_chunk()
    print(f'Total articles to process: {len(article_ids)}')

    links = read_links()
    links = {article_id: links[article_id] for article_id in article_ids}

    s = time.time()
    for i in range(0, len(article_ids), BATCH_SIZE):
        print('Batch starting with row:', i)
        batch = article_ids[i : i + BATCH_SIZE]
        process_article_batch(batch, links)
        cur = time.time()
        articles_per_second = round((i + BATCH_SIZE) / (cur - s), 2)
        print(f'Articles per seconds so far: {articles_per_second}\n')