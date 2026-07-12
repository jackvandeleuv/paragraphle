import os
import json 
import time 
import pandas as pd
import numpy as np
import base64
from openai import OpenAI
import sqlite3
from dotenv import load_dotenv
from config import (
    MODEL,
    EMBED_DIM,
    CHUNKS_PER_BATCH,
    COST_PER_TOKEN,
)

total_chunks = 0
total_tokens = 0    

def embed_chunk(df, i, client, window):
    window = df.iloc[i : i + window]
    chunk_ids = window['chunk_id'].values.tolist()
    article_ids = window['article_id'].values.tolist()

    ATTEMPTS = 5
    success = False
    for attempt in range(ATTEMPTS):
        try:
            result = client.embeddings.create(
                input=window['chunk'].values.tolist(),
                model=MODEL,
                dimensions=EMBED_DIM
            )
            success = True
            break
        except Exception as e:
            print(e)
            print(f'Sleeping {3 ** attempt} seconds...')
            time.sleep(3 ** attempt)

    if not success:
        raise Exception(f'Exceeded max embed attempts on idx {i}')

    global total_tokens
    total_tokens += result.usage.total_tokens

    return [
        {
            'chunk_id': chunk_ids[i], 
            'article_id': article_ids[i],
            'embedding': np.asarray(x.embedding, dtype="<f2").tobytes(),
        } 
        for i, x in enumerate(result.data)
    ]

def write_embeddings(embeddings):
    to_insert = [(r['embedding'], r['article_id'], r['chunk_id']) for r in embeddings]

    conn = sqlite3.Connection('data/local.db')
    try:
        cur = conn.cursor()
        cur.executemany('''
            insert into embeddings (vector, article_id, chunk_id)
            values (?, ?, ?)
            on conflict (chunk_id) do
                update set
                    vector = excluded.vector,
                    article_id = excluded.article_id
        ''', to_insert)
        conn.commit()
    finally:
        conn.close()

def embed_df(df, client):
    global total_tokens
    i = 0
    while i + CHUNKS_PER_BATCH < len(df):
        write_embeddings(embed_chunk(df, i, client, CHUNKS_PER_BATCH))
        i += CHUNKS_PER_BATCH
        print(f"Total tokens spent: {total_tokens}. (${round(total_tokens * COST_PER_TOKEN, 3)}).")
    
    if i < len(df):
        write_embeddings(embed_chunk(df, i, client, CHUNKS_PER_BATCH))

def get_total_chunks():
    conn = sqlite3.Connection('data/local.db')
    try:
        query = f'''
            select count(*) as count
            from chunks 
        '''
        return pd.read_sql(query, conn).iloc[0]['count']
    finally:
        conn.close()

def get_chunk_batch(limit, offset):
    conn = sqlite3.Connection('data/local.db')
    try:
        query = f'''
            select article_id, chunk_id, chunk 
            from chunks 
            order by chunk_id
            limit {limit}
            offset {offset}
        '''
        return pd.read_sql(query, conn)
    finally:
        conn.close()

def embed_chunks():
    load_dotenv()

    client = OpenAI(api_key=os.environ.get("API_KEY"))

    total_chunks = get_total_chunks()
    print(f'Embedding {total_chunks} total chunks...')

    BATCH_SIZE = 10000
    chunks = 0
    for _ in range(0, total_chunks, BATCH_SIZE):
        batch = get_chunk_batch(BATCH_SIZE, chunks)
        s = time.time()
        embed_df(batch, client)
        chunks += BATCH_SIZE
        time_to_finish = round(time.time() - s, 1)
        print(f'Processed {chunks} chunks in {time_to_finish}s')
