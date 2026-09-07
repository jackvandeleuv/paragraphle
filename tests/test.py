import pandas as pd
import sqlite3
import base64
import numpy as np


pd.set_option('display.max_columns', None)
pd.set_option('display.max_rows', 300)

conn = sqlite3.connect(path)

df = pd.read_sql('''

select article_id, title
--select count(*)
from articles
where count > 400
order by random()
limit 50

''', conn)

print(df)

# '''
# For every target_article_id, what % of sessions resulted in a win
# '''
# df = pd.read_sql('''
# select 
#     targets.target_article_id, 
#     a.title,
#     sum(is_win) as sum_is_win, 
#     count(is_win) as total_sessions,
#     sum(guesses) as total_guesses
# from (
#     select distinct 
#         g.target_article_id,
#         g.session_id,
#         count(g.guess_id) as guesses,
#         max(case when w.session_id is null then 0 else 1 end) as is_win 
#     from guesses g
#     left join wins w
#         on g.session_id == w.session_id
#     group by g.target_article_id, g.session_id
# ) as targets
# join articles a 
#     on targets.target_article_id == a.article_id
# group by target_article_id

# ''', conn)

# df['win_ratio'] = df.sum_is_win / df.total_sessions
# df['avg_guesses'] = df.total_guesses / df.total_sessions

# df = df[df.total_sessions >= 5]
# print(df[['title', 'win_ratio', 'avg_guesses', 'total_sessions']].sort_values('win_ratio'))