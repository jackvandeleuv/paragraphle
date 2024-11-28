from flask import Flask
import sqlite3
from markupsafe import escape
import json
from scipy.spatial import distance
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"

EXACT_MATCH = """
    select e.id, a.title, a.url
    from embeddings e
    join articles a
        using(id)
    where lower(a.title) like ?
    order by a.title asc
    limit ?
"""

def get_match(cur, q, limit):
    cur.execute(EXACT_MATCH, ((q, limit)))
    return [
        {
            'id': x[0],
            'title': x[1],
            'url': x[2]
        }
        for x in cur.fetchall()
    ]

@app.route("/suggestion/<q>/limit/<limit>")
def suggestion(q, limit):
    q = escape(q).lower()

    limit = int(escape(limit))

    conn = sqlite3.Connection('data.db')
    cur = conn.cursor()

    results = get_match(cur, q + '%', limit)
    
    if len(results) >= limit:
        return results
    
    q = q + '%'
    results.extend(get_match(cur, q, limit))
    results = results[: limit]

    if len(results) >= limit:
        return results

    q = '%' + q
    results.extend(get_match(cur, q, limit))
    results = results[: limit]
        
    return results

@app.route("/guess/<id>")
def guess(id):
    DAILY_WORD = 336

    id = int(escape(id))

    conn = sqlite3.Connection('data.db')
    cur = conn.cursor()

    QUERY = """
        select vector
        from embeddings
        where id in (?, ?)
    """

    cur.execute(QUERY, (DAILY_WORD, id))
    a, b = cur.fetchall()

    return str(distance.cosine(json.loads(a[0]), json.loads(b[0])))
