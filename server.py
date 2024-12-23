from flask import Flask
import sqlite3
from markupsafe import escape
import json
from scipy.spatial import distance
from flask_cors import CORS
from copy import copy

app = Flask(__name__)
CORS(app)


conn = sqlite3.Connection('stable/data/data.db')
cur = conn.cursor()

cur.execute("select id, clean_title, count from articles order by count desc")
articles = cur.fetchall()
articles = list(sorted(
    articles, key=lambda x: x[1]
))


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

    return list(
        sorted(
            array[left : right],
            key=lambda x: x[2],
            reverse=True
        )[: limit]
    )


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

    return bin_prefix_search(articles, q, limit)
        
# @app.route("/guess/<id>")
# def guess(id):
#     DAILY_WORD = 336

#     id = int(escape(id))

#     QUERY = """
#         select vector
#         from embeddings
#         where id in (?, ?)
#     """

#     cur.execute(QUERY, (DAILY_WORD, id))
#     a, b = cur.fetchall()

#     return str(distance.cosine(json.loads(a[0]), json.loads(b[0])))
