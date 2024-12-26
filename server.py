from flask import Flask
import sqlite3
from markupsafe import escape
import json
from scipy.spatial import distance
from flask_cors import CORS
from copy import deepcopy
import numpy as np
from numpy.linalg import norm
from numpy import dot

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

app = Flask(__name__)
CORS(app)


conn = sqlite3.Connection('stable/data/data.db')
cur = conn.cursor()

cur.execute("select id, clean_title, count from articles")
articles = cur.fetchall()
articles = sorted(articles, key=lambda x: x[1])

conn.close()

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

@app.route("/suggestion/<q>/limit/<limit>")
def suggestion(q, limit):
    q = escape(q).lower()

    limit = int(escape(limit))

    result = bin_prefix_search(articles, q, limit)
    if result:
        return result
    return []
        
@app.route("/guess_string/<string>")
def guess_string(string):
    return ''

@app.route("/guess_id/<id>")
def guess_id(id):
    conn = sqlite3.Connection('stable/data/data.db')
    cur = conn.cursor()

    i = 2304232127028 % random.__len__()
    DAILY_WORD = random[i][0]
    # print(random[i])

    id = int(escape(id))

    if id == DAILY_WORD:
        return "0"

    QUERY = """
        select vector
        from embeddings
        where id in (?, ?)
    """

    try:
        cur.execute(QUERY, (DAILY_WORD, id))
        a, b = cur.fetchall()

        a = np.frombuffer(a[0])
        b = np.frombuffer(b[0])

        return str(
           1 - (a.dot(b) / (norm(a) * norm(b)))
        )
    except Exception as e:
        return str(e)
    finally:
        conn.close()
