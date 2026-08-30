import sqlite3
import pandas as pd

pd.set_option('display.max_columns', None)

df = pd.read_csv('wins.csv')
# df.groupby('guess_article_id').size().sort_values(ascending=False)
print(len(df))

tables = [
    'articles',
    'chunks',
    'embeddings',
    'guesses',
    'sessions',
    'to_filter',
    'wins',
]
try:
    conn = sqlite3.connect('data.db')
    for t in tables:
        df = pd.read_csv(f'{t}.csv')
        df.to_sql(t, conn)
    conn.commit()
finally:
    conn.close()    