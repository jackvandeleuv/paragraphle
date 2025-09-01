# Migration

import pandas as pd
import sqlite3

DB_PATH = '../backend/data.db'

conn = sqlite3.Connection(DB_PATH)
cur = conn.cursor()

cur.execute("drop table if exists guesses")
conn.commit()

cur.execute("""
    create table if not exists guesses (
        guess_id integer primary key,
        created_timestamp integer,
        guess_article_id integer,
        target_article_id integer,
        best_chunk_id integer,
        best_chunk_score real,
        session_id text
    )
""")
conn.commit()

cur.execute("drop table if exists wins")
conn.commit()

cur.execute("""
    create table if not exists wins (
        created_timestamp integer,
        guesses integer,
        session_id text
    )
""")
conn.commit()

cur.execute("drop table if exists sessions")
conn.commit()

cur.execute("""
    create table if not exists sessions (
        created_timestamp integer,
        session_id text
    )
""")
conn.commit()

# Make sure all the filters and joined in server.go are indexed
indices = [
    'create index idx_guesses_guess_article_id on guesses(guess_article_id)',
    'create index idx_guesses_created_timestamp on guesses(created_timestamp)',
    'create index idx_guesses_session_id on guesses(session_id)',

    'create index idx_wins_created_timestamp on wins(created_timestamp)',
    'create index idx_wins_session_id on wins(session_id)',

    'create index idx_sessions_created_timestamp on sessions(created_timestamp)',
    'create index idx_sessions_session_id on sessions(session_id)',
]

for index in indices:
    conn.execute(index)
    conn.commit()

conn.close()
