from flask import Flask
import sqlite3
from markupsafe import escape
import json
from scipy.spatial import distance
from flask_cors import CORS
from copy import copy

app = Flask(__name__)
CORS(app)





def build_btree():
    conn = sqlite3.Connection('data/data.db')
    cur = conn.cursor()
    cur.execute("select id, clean_title from articles")
    articles = cur.fetchall()


# MATCH = """
#     select id, title, url
#     from articles
#     where clean_title like ?
#     order by count desc
#     limit ?
# """

# def get_match(cur, q, limit):
#     cur.execute(MATCH, ((q, limit)))
#     return [
#         {
#             'id': x[0],
#             'title': x[1],
#             'url': x[2]
#         }
#         for x in cur.fetchall()
#     ]

@app.route("/suggestion/<q>/limit/<limit>")
def suggestion(q, limit):
    q = escape(q).lower()

    limit = int(escape(limit))

    results = get_match(cur, q + '%', limit)
        
    return results

@app.route("/guess/<id>")
def guess(id):
    DAILY_WORD = 336

    id = int(escape(id))

    for in_use

    QUERY = """
        select vector
        from embeddings
        where id in (?, ?)
    """

    cur.execute(QUERY, (DAILY_WORD, id))
    a, b = cur.fetchall()

    return str(distance.cosine(json.loads(a[0]), json.loads(b[0])))
