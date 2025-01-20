from flask import Flask, jsonify, request, Response
import sqlite3
from markupsafe import escape
from flask_cors import CORS
from copy import deepcopy
import numpy as np
from numpy.linalg import norm
from numpy import dot
import threading
import time

random = [
(1164, 'artificial intelligence'),
(84493, 'savannah, georgia'),
(990329, 'gamespot'),
(57447, 'charlotte, north carolina'),
(60192, 'bruce springsteen'),
(17416221, 'south africa'),
(534366, 'barack obama'),
(5119376, 'john f. kennedy'),
(18973446, 'geometry'),
(173070, 'the wall street journal'),
(5551, 'costa rica'),
(167409, 'alternative rock'),
(3524766, 'youtube'),
(23245410, 'academy award for best actor'),
(808, 'alfred hitchcock'),
(701, 'angola'),
(319442, 'san francisco chronicle'),
(5334607, 'africa'),
(3352, 'blues'),
(585629, 'kyiv'),
(52911, 'town'),
(26230922, 'nobel peace prize'),
(689, 'asia'),
(19468510, 'united states house of representatives'),
(12153654, 'elizabeth ii'),
(4699587, 'fish'),
(863, 'american civil war'),
(2569378, 'hurricane katrina'),
(23534170, 'fantasy'),
(3969, 'buckingham palace'),
(5884, 'charles dickens'),
(19334491, 'vishnu'),
(42010, 'queen (band)'),
(54422, 'chinese civil war'),
(1998, 'austin, texas')
]

def get_articles():
    conn = sqlite3.Connection('stable/data/data.db')
    cur = conn.cursor()
    cur.execute("select id, clean_title, count, title from articles")
    articles = cur.fetchall()
    articles = sorted(articles, key=lambda x: x[1])
    conn.close()
    return articles

def get_daily_word_vector(id):
    conn = sqlite3.Connection('stable/data/data.db')
    cur = conn.cursor()
    cur.execute("""
        select vector
        from embeddings
        where id == ?
    """, (id,))
    vector = np.frombuffer(cur.fetchone()[0])
    conn.close()
    return vector

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

def get_cluster_examples():
    conn = sqlite3.Connection('stable/data/data.db')
    cur = conn.cursor()
    cur.execute("""
        select cluster, title, count
        from (
            select 
                title,
                cluster,
                count, 
                row_number() over (
                    partition by cluster
                    order by count desc
                ) as rank
            from articles
        ) sub
        where rank <= 5
    """)
    rows = cur.fetchall()
    conn.close()

    top = {}
    for cluster, title, count in rows:
        row = {'title': title, 'score': count}
        if cluster in top:
            top[cluster].append(row)
        else:
            top[cluster] = [row]
    return top


app = Flask(__name__)
CORS(app)

# Global variables.
articles = get_articles()
DAILY_WORD = 4637590
daily_vec = get_daily_word_vector(DAILY_WORD)
cluster_examples = get_cluster_examples()


@app.route("/suggestion/<q>/limit/<limit>")
def suggestion(q, limit):
    q = escape(q).lower()

    limit = int(escape(limit))

    result = bin_prefix_search(articles, q, limit)
    if result:
        return jsonify(result), 200
    return "No matching article.", 404

def log_guess(guess_id, timestamp, ip):
    conn = sqlite3.Connection('stable/data/data.db')
    cur = conn.cursor()
    try:
        cur.execute("""
            insert into guesses (
                guess_id, timestamp, ip
            ) values (?, ?, ?)
        """, (guess_id, timestamp, ip)
        )
        conn.commit()
    except Exception as e:
        print(e)

    conn.close()

@app.route("/ping/<width>/<height>/<innerWidth>/<innerHeight>/<pixelRatio>")
def ping(width, height, innerWidth, innerHeight, pixelRatio):
    user = request.headers.get('User-Agent', '')
    referer = request.headers.get('Referer', '')
    ip = request.remote_addr
    timestamp = time.time()

    conn = sqlite3.Connection('stable/data/data.db')
    cur = conn.cursor()
    try:
        cur.execute("""
            insert into ping (
                user_agent,
                referer,
                ip,
                timestamp,
                width,
                height,
                inner_width,
                inner_height,
                pixelRatio
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user, 
            referer, 
            ip, 
            timestamp, 
            width, 
            height, 
            innerWidth, 
            innerHeight, 
            pixelRatio
        ))
        conn.commit()
    except Exception as e:
        print(e)

    conn.close()

    return jsonify([])

@app.route("/cluster_example/<cluster_id>")
def cluster_example(cluster_id):
    cluster_id = int(escape(cluster_id))
    return jsonify(
        cluster_examples[cluster_id]
    )

@app.route("/guess_id/<id>")
def guess_id(id):
    try:
        conn = sqlite3.Connection('stable/data/data.db')
        cur = conn.cursor()

        id = int(escape(id))

        cur.execute("""
            select vector
            from embeddings 
            where id == ?
        """, (id,))

        guess = cur.fetchone()[0]

        cur.execute("""
            select cluster, title
            from articles 
            where id == ?
        """, (id,))

        cluster, title = cur.fetchone()

        guess = np.frombuffer(guess)

        if id == DAILY_WORD:
            return jsonify({
                'distance': 0.0,
                'cluster': float(cluster),
                'title': title
            })
        
        distance = 1 - (dot(guess, daily_vec) / (norm(guess) * norm(daily_vec)))

        ip = request.remote_addr
        timestamp = time.time()
        threading.Thread(target=log_guess, args=(id, timestamp, ip)).start()

        return jsonify({
            'cluster': float(cluster),
            'distance': float(distance),
            'title': title
        })

    except Exception as e:
        print(e)
        return str(e)
    finally:
        conn.close()
