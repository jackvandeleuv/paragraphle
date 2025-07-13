from flask import Flask, jsonify
import sqlite3
from markupsafe import escape
from flask_cors import CORS
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
import os 
from collections import Counter, defaultdict
from typing import List
import json
import time

load_dotenv()

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
DB_PATH = os.environ.get('DB_PATH')

STOP_WORDS = set([
    'a', 'on', 'had',
    'it', 'any', 'and',
    'of', 'in', 'is',
    'as', 'was', 'or',
    'by', 'for', 'that',
    'from', 'be', 'which',
    'use',  'they', 'known',
    'may',  'other', 'has', 
    'into',  'the', 'with',
    'an', 'to', 'its',
    'he', 'his', 'at',
    '–', 'are', 'all',
    'both', 'she', 'her',
    'there', 'were', 'during',
    'used', 'have', 'also',
    'these', 'after', 'who',
    'but', 'new', 'their',
    'such', 'not', 'been',
    'this', 'can', 'more',
    'many', 'this'
])

class Article:
    def __init__(self, article_id, clean_title, count, title, url):
        self.clean_title = escape(clean_title)  # Equivalent to: escape(title.lower().strip())
        self.count = count
        self.article_id = article_id
        self.title = title
        self.url = url
    
    def unpack(self) -> str:
        return (self.article_id, self.clean_title, self.count, self.title, self.url)
    
    def deep_copy(self):
        return Article(
            self.article_id, 
            self.clean_title, 
            self.count, 
            self.title, 
            self.url
        )
    
    def to_json(self):
        return {
            'article_id': self.article_id, 
            'clean_title': self.clean_title, 
            'count': self.count, 
            'title': self.title, 
            'url': self.url
        }

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
    _, guess_matrix = get_guess_info(conn, cur, article_id)
    return guess_matrix.mean(axis=0)

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

def make_suggestion_cache(cache_limit):
    strings = list('abcdefghijklmnopqrstuvwxyz')

    cache = {}

    for string1 in strings:
        cache[string1] = bin_prefix_search(articles, string1, cache_limit)
        for string2 in strings:
            cache[string1 + string2] = bin_prefix_search(articles, string1 + string2, cache_limit)
 
    return cache

def get_target_word_choices():
    data = []
    with open('ai_targets.jsonl', 'r', encoding='utf-8') as file:
        for line in file:
            data.append(json.loads(line)['article_id'])
    return data

def get_daily_word():
    index = int(int(time.time()) / (60 * 60 * 24))
    return target_word_choices[index % len(target_word_choices)]

def get_daily_word_vec():
    index = int(int(time.time()) / (60 * 60 * 24))
    return daily_vec_choices[index % len(daily_vec_choices)]

def get_guess_info(conn, cur, article_id):
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

    return guess, guess_matrix


app = Flask(__name__)
CORS(app)

app.config.update(
    DEBUG=False,      
    ENV="production", 
)


# Global variables.
EMBEDDING_MODEL = "text-embedding-3-small"
target_word_choices = get_target_word_choices()
CACHE_LIMIT = 50
articles = get_articles()

# daily_vec_choices = []
# for i, article_id in enumerate(target_word_choices):
#     print(f"Loading vectors: {i + 1} / {len(target_word_choices)}")
#     daily_vec_choices.append(get_daily_word_vector_live(article_id))
# np.save('ai_target_vecs', np.array(daily_vec_choices))
daily_vec_choices = np.load('ai_target_vecs.npy')

suggestion_cache = make_suggestion_cache(CACHE_LIMIT)

@app.route("/target_stats")
def target_stats():
    return jsonify(get_daily_word_stats(get_daily_word())), 200

@app.route("/suggestion/<q>/limit/<limit>")
def suggestion(q, limit):
    q = escape(q).lower()

    try:
        limit = int(escape(limit))
    except ValueError as e:
        print(e)
        return "Invalid ID.", 404
    
    if (cached_result := suggestion_cache.get(q, [])) and limit < CACHE_LIMIT:
        return jsonify({
            'has_match': True, 
            'data': [row.to_json() for row in cached_result[-limit :]]
        })

    result = bin_prefix_search(articles, q, limit)

    if result:
        return jsonify({
            'has_match': True, 
            'data': [row.to_json() for row in result]
        }), 200
    
    return jsonify({
        'has_match': False, 
        'data': []
    }), 200
    
@app.route("/guess_article/<article_id>/limit/<limit>")
def guess_article(article_id, limit):
    try:
        article_id = int(escape(article_id))
        limit = int(escape(limit))

        conn = sqlite3.Connection(DB_PATH)
        cur = conn.cursor()

        if article_id < 0:
            return 'Invalid article ID.', 404
        
        guess, guess_matrix = get_guess_info(conn, cur, article_id)

        # Vectorized cosine distance.
        # Faster than iteratively calling distance.cosine().
        daily_vec = get_daily_word_vec()
        numerator = guess_matrix @ daily_vec
        denominator_rhs = np.sqrt(np.sum(daily_vec ** 2)) 
        denominator_lhs = np.sqrt(np.sum(guess_matrix ** 2, axis=1))
        denominator = denominator_lhs * denominator_rhs
        distances = 1 - (numerator / denominator)

        indices = np.argsort(distances)

        return jsonify([
            {
                'chunk_id': guess[i][0], 
                'chunk': guess[i][1], 
                'distance': distances[i], 
                'url': guess[i][2],
                'is_win': article_id == get_daily_word()
            }
            for i in indices[: limit]
        ])
        
    except Exception as e:
        print(e)
        return 'Internal server error.', 500
    finally:
        conn.close()
