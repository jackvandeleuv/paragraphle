import sqlite3

conn = sqlite3.connect('./data/local.db')
import pandas as pd

pd.set_option('display.max_columns', None)

df = pd.read_sql('select * from articles', conn)
print('articles')
print(df.sample(10))

# df = pd.read_sql('select * from embeddings', conn)
# print('embeddings')
# print(df.sample(10))

df = pd.read_sql('select * from chunks order by random() limit 10', conn)
print('chunks')
for _, r in df.iterrows():
    print(r['chunk'])
    print('----------------')
