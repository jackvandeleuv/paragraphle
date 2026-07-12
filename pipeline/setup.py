import sqlite3

def __execute_stmt(query):
    conn = sqlite3.Connection('data/local.db')
    try:
        cur = conn.cursor()
        cur.execute(query)
        conn.commit()
    finally:
        conn.close()

def __create_raw_articles():
    __execute_stmt('''
        create table if not exists raw_articles (
            article_id text not null primary key,
            redirect text,
            text text
        )
    ''')

def __create_articles():
    __execute_stmt('''
        create table if not exists articles (
            article_id text not null primary key,
            alias text,
            count integer
        )
    ''')

def __create_chunks():
    __execute_stmt('''
        create table if not exists chunks (
            chunk_id text not null primary key, 
            article_id text, 
            chunk text,
            foreign key (article_id) references articles(article_id)
        )
    ''')

def __create_embeddings():
    __execute_stmt('''
        create table if not exists embeddings (
            chunk_id text not null primary key, 
            vector blob,
            article_id integer,
            CHECK(length(vector) = 512),   -- Enforce blob size
            FOREIGN KEY (article_id) REFERENCES articles(article_id),
            FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id)
        )
    ''')

def __create_guesses():
    __execute_stmt('''
        create table if not exists guesses (
            guess_id integer primary key,
            created_timestamp integer,
            guess_article_id integer,
            target_article_id integer,
            best_chunk_id integer,
            best_chunk_score real,
            session_id text
        )
    ''')

def __create_wins():
    __execute_stmt('''
        create table if not exists wins (
            created_timestamp integer,
            guesses integer,
            session_id text
        )
    ''')

def __create_sessions():
    __execute_stmt('''
    create table if not exists sessions (
            created_timestamp integer,
            session_id text
        )
    ''')

def __create_indices():
    indices = [
        'create index if not exists idx_articles_article_id on articles(article_id)',
        'create index if not exists idx_articles_count on articles(count)',

        'create index if not exists idx_chunks_article_id on chunks(article_id)',
        'create index if not exists idx_chunks_chunk_id on chunks(chunk_id)',

        'create index if not exists idx_embeddings_article_id on embeddings(article_id)',
        'create index if not exists idx_embeddings_chunk_id on embeddings(chunk_id)',

        'create index if not exists idx_guesses_guess_article_id on guesses(guess_article_id)',
        'create index if not exists idx_guesses_created_timestamp on guesses(created_timestamp)',
        'create index if not exists idx_guesses_session_id on guesses(session_id)',

        'create index if not exists idx_wins_created_timestamp on wins(created_timestamp)',
        'create index if not exists idx_wins_session_id on wins(session_id)',

        'create index if not exists idx_sessions_created_timestamp on sessions(created_timestamp)',
        'create index if not exists idx_sessions_session_id on sessions(session_id)',
    ]

    for index_stmt in indices:
        __execute_stmt(index_stmt)

def create_db():
    '''
        Initial setup for the SQLite DB.
    '''
    # These tables are populated by the pipeline.
    __create_raw_articles()
    __create_articles()
    __create_chunks()
    __create_embeddings()

    # These tables start empty and are used by the game.
    __create_guesses()
    __create_wins()
    __create_sessions()

    # Index commonly-used tables.
    __create_indices()