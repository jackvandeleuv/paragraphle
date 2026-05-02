import time 
import sqlite3
import os 
import numpy as np

def array_to_blob(array):
    array = np.asarray(array, dtype=np.float32)
    array = np.ascontiguousarray(array)
    return array.tobytes(order="C") 

def embed(chunks, model, conn, is_sentence):
    cur = conn.cursor()

    s = time.time()

    to_embed = [x[1] for x in chunks]
    embeddings = model.encode(to_embed)

    timestamp = int(time.time() * 1000)
    rows = [
        (timestamp, timestamp, chunk[0], array_to_blob(embeddings[i]), chunk[2]) 
        for i, chunk in enumerate(chunks)
    ]
    
    fk_type = 'sentence_id' if is_sentence else 'summary_id'
    cur.executemany(f'''
        insert into embeddings (created, modified, {fk_type}, embedding, article_id) values (?, ?, ?, ?, ?)
    ''', rows)
    conn.commit()

    print('sentences per second embedded:', len(to_embed) / (time.time() - s))
    print(f'total time to embed {len(chunks)} chunks: {round(time.time() - s, 2)}')


def load_model(model_name):
    s = time.time()
    from sentence_transformers import SentenceTransformer
    print('time to import sentence transformers', round(time.time() - s, 2))

    s = time.time()

    onnx_dir = 'onnx'

    if not os.path.isdir(onnx_dir):
        model = SentenceTransformer(model_name, backend='onnx', trust_remote_code=False)
        model.save_pretrained(onnx_dir)
    else:
        model = SentenceTransformer(onnx_dir, backend="onnx", model_kwargs={"export": False}, trust_remote_code=False)
    
    print('time to load model:', round(time.time() - s, 2))
    return model

def get_summaries_to_embed(conn, n):
    s = time.time()
    cur = conn.cursor()

    cur.execute(f'''
        select 
            summaries.id, 
            summaries.extract,
            summaries.article_id
        from summaries
        left join embeddings
            on embeddings.summary_id == summaries.id
        where embeddings.id is null
        limit {n}
    ''')

    print(f'returned {n} rows in {round(time.time() - s, 2)} seconds')

    return cur.fetchall()

def get_sentences_to_embed(conn, n):
    s = time.time()
    cur = conn.cursor()

    cur.execute(f'''
        select 
            sentences.id, 
            sentences.sentence,
            sentences.article_id
        from sentences
        left join embeddings
            on embeddings.sentence_id == sentences.id
        where embeddings.id is null
        limit {n}
    ''')

    print(f'returned {n} rows in {round(time.time() - s, 2)} seconds')

    return cur.fetchall()

def get_rows_to_embed(conn, n, mode):
    if mode == 'sentences':
        return get_sentences_to_embed(conn, n)
    elif mode == 'summaries':
        return get_summaries_to_embed(conn, n)
    else:
        raise ValueError('invalid mode:', mode)

def main(conn, mode='sentences', model_name = 'all-MiniLM-L6-v2'):
    s = time.time()
    total = 0
    N = 1000
    model = load_model(model_name)
    summaries = get_rows_to_embed(conn, N, mode)
    while summaries:
        embed(summaries, model, conn, mode == 'sentences')
        summaries = get_rows_to_embed(conn, N, mode)
        total += N
        print(f"Running total:\n{total} chunks.\n{round(time.time() - s, 2)} seconds.\nChunks per second: {total / round((time.time() - s), 2)}")

if __name__ == '__main__':
    conn = sqlite3.Connection('data.db')
    try:
        main(conn)
    finally:
        conn.close()
