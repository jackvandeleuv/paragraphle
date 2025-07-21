import pandas as pd
import sqlite3 
import json 

DB_PATH = 'backend/data.db'

conn = sqlite3.Connection(DB_PATH)

pd.read_parquet('preprocessing/data/scraped_articles_top5_len40_stride15.parquet') \
    .rename(columns={'lower_title': 'clean_title'}) \
    .to_sql('articles', conn, if_exists='append', index=False)

conn.commit()

buffer = []
with open('preprocessing/data/scraped_chunks_top5_len40_stride15.jsonl', 'r') as file:
    for line in file:
        buffer.append(json.loads(line))

        if len(buffer) > 100000:
            print('Clearing buffer.')
            pd.DataFrame(buffer).to_sql('chunks', conn, if_exists='append', index=False)
            buffer = []
            conn.commit()

if buffer:
    pd.DataFrame(buffer).to_sql('chunks', conn, if_exists='append', index=False)
    buffer = []
    conn.commit()

conn.close()