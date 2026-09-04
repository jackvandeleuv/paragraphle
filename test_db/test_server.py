import requests
import pandas as pd
import sqlite3

pd.set_option('display.max_columns', None)

conn = sqlite3.connect("data/data.db")


# import sqlite3
# import ast

# db_path = "data/data.db"
# table = "embeddings"
# id_col = "id"
# embedding_col = "vector"

# conn = sqlite3.connect(db_path)

# batch_size = 10_000


# # These can substantially improve bulk-update performance.
# conn.execute("PRAGMA journal_mode=WAL")
# conn.execute("PRAGMA synchronous=NORMAL")

# select_cur = conn.execute(
#     f"""
#     SELECT {id_col}, {embedding_col}
#     FROM {table}
#     WHERE typeof({embedding_col}) = 'text'
#     """
# )

# converted = 0

# try:
#     while True:
#         rows = select_cur.fetchmany(batch_size)
#         print('batch!kkk')

#         if not rows:
#             break

#         updates = []

#         for row_id, value in rows:
#             original_bytes = ast.literal_eval(value)

#             if not isinstance(original_bytes, bytes):
#                 raise TypeError(
#                     f"Row {row_id}: result is "
#                     f"{type(original_bytes).__name__}, not bytes"
#                 )

#             if len(original_bytes) % 2:
#                 raise ValueError(
#                     f"Row {row_id}: invalid float16 byte length "
#                     f"{len(original_bytes)}"
#                 )

#             updates.append(
#                 (sqlite3.Binary(original_bytes), row_id)
#             )

#         conn.executemany(
#             f"""
#             UPDATE {table}
#             SET {embedding_col} = ?
#             WHERE {id_col} = ?
#             """,
#             updates,
#         )

#         conn.commit()

#         converted += len(updates)
#         print(f"Converted {converted:,} rows")

# finally:
#     conn.close()


# cur = conn.cursor()
# cur.execute("select id, vector from embeddings")
# for row_id, blob in cur.fetchall():
#     if blob is None:
#         print(row_id, "NULL")
#     else:
#         print(row_id, len(blob), "bytes")

# blob = conn.execute("""
#     SELECT vector
#     FROM embeddings
#     limit 1
# """).fetchone()[0]

# print(type(blob))
# print(len(blob))
# print(repr(blob[:100]))


# conn = sqlite3.connect('./data/data.db')
# df = pd.read_sql('''
# select vector
# from embeddings
# limit 5
# ''', conn)
# print(df.iloc[0]['vector'])


URI = 'http://localhost:8000'

def errs(r):
    fail = False
    try:
        r.raise_for_status()
    except Exception as e:
        print(r.status_code)
        print(r.text)
        fail = True
    if fail:
        raise Exception('aahhh')

r = requests.get(f'{URI}/start-session')
errs(r)
s1 = r.text[1 : -2]
print(s1)

r = requests.get(f'{URI}/start-session')
errs(r)
s2 = r.text[1 : -2]
print(s2)

print('getting suggestions')
r = requests.get(f'{URI}/suggestion?limit=5&q=a')
errs(r)
articles = pd.DataFrame(r.json())

a1 = articles.iloc[0]['article_id']
a2 = articles.iloc[1]['article_id']

print('s1, g1:')
r = requests.get(f"{URI}/guess-article?session_id={s1}&article_id={a2}")
errs(r)
# print(pd.DataFrame(r.json()))

print('s1, g2:')
r = requests.get(f"{URI}/guess-article?session_id={s1}&article_id={a1}")
errs(r)
# print(pd.DataFrame(r.json()))

print('s2, g1:')
r = requests.get(f"{URI}/guess-article?session_id={s2}&article_id={a1}")
errs(r)
# print(pd.DataFrame(r.json()))

r = requests.get(f"{URI}/restore-session?session_id={s1}")
errs(r)
print('json:')
print(pd.DataFrame(r.json()))

# conn = sqlite3.connect('./data/data.db')
# df = pd.read_sql('select * from guesses where guess_id is null', conn)
# print(df)

# THE CURRENT ERROR IS BEING CAUSED BY THE FACT THAT
# YOU ARE MISSING THE INTEGER PRIMARY KEY ON GUESSES