import sqlite3

conn = sqlite3.Connection('data.db')
cur = conn.cursor()

INIT_DB = '''

create table if not exists embeddings (
    id integer primary key,
    created integer,
    modified integer,
    sentence_id integer,
    summary_id integer,
    article_id text,
    embedding blob
);

create table if not exists thumbnails (
    id integer primary key,
    created integer,
    modified integer,
    article_id text,
    src text,
    width integer,
    height integer
);

create table if not exists summaries (
    id integer primary key,
    created integer,
    modified integer,
    title text,
    description text,
    extract text,
    article_id text
);

create table if not exists sentences (
    id integer primary key,
    created integer,
    modified integer,
    sentence text,
    tokens integer,
    article_id text        
);

create table if not exists links (
    id integer primary key,
    created integer,
    modified integer,
    parent_article_id text,
    article_id text
);

create table if not exists guesses (
    guess_id integer primary key,
    created_timestamp integer,
    guess_article_id text,
    target_article_id text,
    best_chunk_id integer,
    best_chunk_score real,
    session_id text
);

create table if not exists wins (
    created_timestamp integer,
    guesses integer,
    session_id text
);

create table if not exists sessions (
    created_timestamp integer,
    session_id text
);

create index if not exists idx_guesses_guess_article_id on guesses(guess_article_id);
create index if not exists idx_guesses_created_timestamp on guesses(created_timestamp);
create index if not exists idx_guesses_session_id on guesses(session_id);

create index if not exists idx_wins_created_timestamp on wins(created_timestamp);
create index if not exists idx_wins_session_id on wins(session_id);

create index if not exists idx_sessions_created_timestamp on sessions(created_timestamp);
create index if not exists idx_sessions_session_id on sessions(session_id);

create index if not exists idx_links_article_id on links(article_id);

create index if not exists idx_summaries_article_id on summaries(article_id);

create index if not exists idx_sentences_article_id on sentences(article_id);

create index if not exists idx_embeddings_summary_id on embeddings(summary_id);
create index if not exists idx_embeddings_sentence_id on embeddings(sentence_id);
'''

cur.executescript(INIT_DB)
conn.commit()

conn.close()
