from flask import Flask, jsonify, request
import sqlite3
from markupsafe import escape
from flask_cors import CORS
from copy import deepcopy
import numpy as np
from numpy.linalg import norm
from numpy import dot
import threading
import time
from dotenv import load_dotenv
from openai import OpenAI
import os 

load_dotenv()

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
DB_PATH = 'preprocessing/data/data.db'

def get_articles():
    conn = sqlite3.Connection(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        select 
            article_id, clean_title, count, title 
        from articles""")
    articles = cur.fetchall()
    articles = sorted(articles, key=lambda x: x[1])
    conn.close()
    return articles

def get_daily_word_vector(article_id):
    conn = sqlite3.Connection(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        select vector
        from embeddings
        where article_id == ?
    """, (article_id,))
    vector = np.array([np.frombuffer(row[0]) for row in cur.fetchall()]).mean(axis=0)
    conn.close()
    return vector

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

def bin_prefix_search(array, prefix, limit):
    left = 0
    right = len(array)
    mid = ((right - left) // 2) + left
    size = len(prefix)

    found = False
    while left < right:
        if prefix == array[mid][1][: size]:
            found = True
            break
        elif prefix < array[mid][1][: size]:
            right = mid
            mid = ((right - left) // 2) + left
        else:
            left = mid + 1
            mid = ((right - left) // 2) + left

    if not found:
        return None
            
    left = mid
    while 0 < left - 1 and prefix == array[left - 1][1][: size]:
        left -= 1
        
    # Don't add one to comparisons with right if using slices because it is exclusive
    right = mid
    while right + 1 <= len(array) and prefix == array[right][1][: size]:
        right += 1

    array_slice = array[left : right]  # Shallow copy
    for i in range(len(array_slice)):
        if array_slice[i][1] == prefix:
            copy = list(deepcopy(array_slice[i]))
            copy[2] = 100000  # Higher than any count.
            array_slice[i] = tuple(copy)  # Avoids mutating original list.
    array_slice = sorted(array_slice, key=lambda x: x[2], reverse=True)[: limit]

    return array_slice

app = Flask(__name__)
CORS(app)

# Global variables.
articles = get_articles()
DAILY_WORD = 19017269
# daily_vec = get_daily_word_vector(DAILY_WORD)
daily_vec = get_daily_word_vector_live(DAILY_WORD)
CHUNKS_TO_RETURN = 2

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
        return jsonify(result), 200
    return "No matching article.", 404

# def log_guess(guess_id, timestamp, ip):
#     conn = sqlite3.Connection('stable/data/data.db')
#     cur = conn.cursor()
#     try:
#         cur.execute("""
#             insert into guesses (
#                 guess_id, timestamp, ip
#             ) values (?, ?, ?)
#         """, (guess_id, timestamp, ip)
#         )
#         conn.commit()
#     except Exception as e:
#         print(e)

#     conn.close()

# @app.route("/ping/<width>/<height>/<innerWidth>/<innerHeight>/<pixelRatio>")
# def ping(width, height, innerWidth, innerHeight, pixelRatio):
#     user = request.headers.get('User-Agent', '')
#     referer = request.headers.get('Referer', '')
#     ip = request.remote_addr
#     timestamp = time.time()

#     conn = sqlite3.Connection('stable/data/data.db')
#     cur = conn.cursor()
#     try:
#         cur.execute("""
#             insert into ping (
#                 user_agent,
#                 referer,
#                 ip,
#                 timestamp,
#                 width,
#                 height,
#                 inner_width,
#                 inner_height,
#                 pixelRatio
#             ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
#         """, (
#             user, 
#             referer, 
#             ip, 
#             timestamp, 
#             width, 
#             height, 
#             innerWidth, 
#             innerHeight, 
#             pixelRatio
#         ))
#         conn.commit()
#     except Exception as e:
#         print(e)

#     conn.close()

#     return jsonify([])
    

@app.route("/guess_article/<article_id>")
def guess_article(article_id):
    try:
        conn = sqlite3.Connection('preprocessing/data/data.db')
        cur = conn.cursor()

        article_id = int(escape(article_id))
        
        if article_id == DAILY_WORD:
            print('YOU WON!')
            return jsonify([(-1, 'YOU WON!', 0)])

        # cur.execute("""
        #     select e.vector, e.chunk_id, c.chunk
        #     from (
        #         select vector, chunk_id 
        #         from embeddings
        #         where article_id == ?
        #     ) as e
        #     join (
        #         select chunk_id, chunk
        #         from chunks
        #         where article_id == ?
        #     ) as c
        #         using (chunk_id)
        # """, (article_id, article_id))

        cur.execute("""
            select chunk_id, chunk
            from chunks
            where article_id == ?
        """, (article_id,))
        guess = cur.fetchall()
        result = client.embeddings.create(
            input=[x[1] for x in guess],
            model="text-embedding-3-small"
        )

        guess_matrix = np.array([np.array(x.embedding) for x in result.data])

        print('number of chunks:', guess_matrix.shape[0])

        # Vectorized cosine distance.
        # Faster than iteratively calling distance.cosine().
        numerator = guess_matrix @ daily_vec
        denominator_rhs = np.sqrt(np.sum(daily_vec ** 2)) 
        denominator_lhs = np.sqrt(np.sum(guess_matrix ** 2, axis=1))
        denominator = denominator_lhs * denominator_rhs
        distances = 1 - (numerator / denominator)

        indices = np.argsort(distances)

        return [
            (guess[i][0], guess[i][1], distances[i]) 
            for i in indices
        ][: CHUNKS_TO_RETURN]

        # return [
        #     (guess[i][1], guess[i][2], distances[i]) 
        #     for i in indices
        # ][: CHUNKS_TO_RETURN]
        
    except Exception as e:
        print(e)
        return str(e)
    finally:
        conn.close()
