from flask import Flask, jsonify
import sqlite3
from markupsafe import escape
from flask_cors import CORS
from copy import deepcopy
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
import os 
from collections import Counter, defaultdict
from typing import List
import re

load_dotenv()

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
DB_PATH = 'data.db'

STOP_WORDS = set([
    'a',
    'on',
    'had',
    'it',
    'any',
    'and',
    'of',
    'in',
    'is',
    'as',
    'was',
    'or',
    'by',
    'for',
    'that',
    'from',
    'be',
    'which',
    'use', 
    'they',
    'known',
    'may', 
    'other',
    'has', 
    'into', 
    'the',
    'with',
    'an',
    'to',
    'its',
    'he',
    'his',
    'at',
    '–',
    'are',
    'all',
    'both',
    'she',
    'her',
    'there',
    'were',
    'during',
    'used',
    'have',
    'also',
    'these',
    'after',
    'who',
    'but',
    'new',
    'their',
    'such',
    'not'
])

class Article:
    def __init__(self, article_id, clean_title, count, title, url):
        self.clean_title = escape(clean_title)  # Equivalent to: escape(title.lower().strip())
        self.count = count
        self.data = (article_id, clean_title, count, title, url)
    
    def unpack(self) -> str:
        return (self.article_id, self.clean_title, self.count, self.title, self.url)
    
    def deep_copy(self):
        return Article(*deepcopy(self.data))

def get_articles() -> List[Article]:
    conn = sqlite3.Connection(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        select 
            article_id, clean_title, count, title, url
        from articles
    """)
    articles = [Article(*row) for row in cur.fetchall()]
    articles = sorted(articles, key=lambda x: x.clean_title)
    conn.close()
    return articles

def get_daily_word_vector_live(article_id: int):
    conn = sqlite3.Connection(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        select chunk
        from chunks
        where article_id == ?
    """, (article_id,))
    chunks = [x[0] for x in cur.fetchall()]
    result = client.embeddings.create(
        input=chunks,
        model="text-embedding-3-small"
    )
    return np.array([np.array(x.embedding) for x in result.data]).mean(axis=0)

def get_daily_word_stats(article_id: int):
    conn = sqlite3.Connection(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        select chunk
        from chunks
        where article_id == ?
    """, (article_id,))
    chunks = [x[0].lower().strip() for x in cur.fetchall()]
    n_chunks = len(chunks)

    tokens = ' '.join(chunks).split()
    tokens = [token.lower().strip() for token in tokens]
    n_tokens = len(tokens)

    token_counts = {token: val for token, val in Counter(tokens).items() if token not in STOP_WORDS}

    chunks_with_token = defaultdict(int)
    for chunk in chunks:
        seen = set()
        for token in chunk.split():
            if token in seen:
                continue
            chunks_with_token[token] += 1
            seen.add(token)

    return {
        'n_chunks': n_chunks,
        'n_tokens': n_tokens,
        'chunks_with_token': chunks_with_token,
        'token_counts': token_counts
    }

def bin_prefix_search(array, prefix, limit):
    left = 0
    right = len(array)
    mid = ((right - left) // 2) + left
    size = len(prefix)

    found = False
    while left < right:
        if prefix == array[mid].clean_title[: size]:
            found = True
            break
        elif prefix < array[mid].clean_title[: size]:
            right = mid
            mid = ((right - left) // 2) + left
        else:
            left = mid + 1
            mid = ((right - left) // 2) + left

    if not found:
        return None
            
    left = mid
    while 0 < left - 1 and prefix == array[left - 1].clean_title[: size]:
        left -= 1
        
    # Don't add one to comparisons with right if using slices because it is exclusive
    right = mid
    while right + 1 <= len(array) and prefix == array[right].clean_title[: size]:
        right += 1

    array_slice = array[left : right]  # Shallow copy
    for i in range(len(array_slice)):
        if array_slice[i].clean_title == prefix:
            copy_article = array_slice[i].deep_copy()
            copy_article.count = 100000  # Higher than any count.
    array_slice = sorted(array_slice, key=lambda x: x.count)[-limit :] 

    return array_slice

def cache_embedding(conn, model, article_id, result_data, guess):
    cursor = conn.cursor()
    rows = []
    for i in range(len(result_data)):
        rows.append((
            np.array(result_data[i].embedding).tobytes(), 
            article_id, 
            guess[i][0], 
            model
        ))

    cursor.executemany("""
        insert into embeddings (vector, article_id, chunk_id, model) values (?, ?, ?, ?)
    """, (rows))
    
    conn.commit()

def get_cached_embedding(conn, article_id):
    cursor = conn.cursor()
    cursor.execute("""
        select vector 
        from embeddings 
        where article_id == ? 
        order by chunk_id desc
    """, (article_id,))
    rows = cursor.fetchall()
    if not rows:
        return None
    return np.array([np.frombuffer(row[0]) for row in rows])

app = Flask(__name__)
CORS(app)

# Global variables.
EMBEDDING_MODEL = "text-embedding-3-small"
DAILY_WORD = 14666430
articles = get_articles()
daily_vec = get_daily_word_vector_live(DAILY_WORD)

@app.route("/target_stats")
def target_stats():
    return jsonify(get_daily_word_stats(DAILY_WORD)), 200

@app.route("/suggestion/<q>/limit/<limit>")
def suggestion(q, limit):
    q = escape(q).lower()

    try:
        limit = int(escape(limit))
    except ValueError as e:
        print(e)
        return "Invalid ID.", 404

    result = bin_prefix_search(articles, q, limit)

    if result:
        return jsonify([row.data for row in result]), 200
    return "No matching article.", 404
    
@app.route("/guess_article/<article_id>/limit/<limit>")
def guess_article(article_id, limit):
    try:
        conn = sqlite3.Connection(DB_PATH)
        cur = conn.cursor()

        article_id = int(escape(article_id))
        if article_id == -1:
            return 'Invalid article ID.', 404
        
        limit = int(escape(limit))

        if article_id == DAILY_WORD:
            return jsonify([(-1, 'YOU WON!', 0)])

        cur.execute("""
            select chunk_id, chunk, url
            from (
                select chunk_id, chunk, article_id
                from chunks
                where article_id == ?
            ) as c
            join (
                select article_id, url
                from articles
                where article_id == ?    
            ) as a
                on c.article_id == a.article_id
            order by chunk_id desc
        """, (article_id, article_id))
        guess = cur.fetchall()

        guess_matrix = get_cached_embedding(conn, article_id)
        if guess_matrix is None:
            result = client.embeddings.create(input=[x[1] for x in guess], model=EMBEDDING_MODEL)
            cache_embedding(conn, EMBEDDING_MODEL, article_id, result.data, guess)
            guess_matrix = np.array([np.array(x.embedding) for x in result.data])

        # Vectorized cosine distance.
        # Faster than iteratively calling distance.cosine().
        numerator = guess_matrix @ daily_vec
        denominator_rhs = np.sqrt(np.sum(daily_vec ** 2)) 
        denominator_lhs = np.sqrt(np.sum(guess_matrix ** 2, axis=1))
        denominator = denominator_lhs * denominator_rhs
        distances = 1 - (numerator / denominator)

        indices = np.argsort(distances)

        return [
            (guess[i][0], guess[i][1], distances[i], guess[i][2]) 
            for i in indices
        ][: limit]
        
    except Exception as e:
        print(e)
        return 'Internal server error.', 500
    finally:
        conn.close()
