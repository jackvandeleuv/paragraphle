import pandas as pd
import sqlite3

pd.set_option('display.max_columns', None)

conn = sqlite3.connect(path)
df = pd.read_sql('''
select *
from articles
where count > 100
order by random()
limit 5
    ''', conn)

print(df)

# conn = sqlite3.connect('data.db')
# df = pd.read_sql('''
# select *
# from guesses
#     ''', conn)


# df = pd.read_sql('''
# select a1.title, g.best_chunk_score,
#     c.chunk, guess_article_id, a2.title as answer
# from (
#     select session_id
#     from sessions
#     order by random()
#     limit 1 
# ) sub
# join guesses g
#     on sub.session_id == g.session_id

# join articles a1
#   on a1.article_id == g.guess_article_id
# join articles a2
#   on a2.article_id == g.target_article_id
# join chunks c
#     on c.chunk_id == g.best_chunk_id
# order by g.created_timestamp asc
#     ''', conn)

# # print(df.sample())
# print(df.head(100))

# for idx, row in df.iterrows():
#     print(row['title'])
#     print(row['chunk']) 
#     print('-------------------------------')