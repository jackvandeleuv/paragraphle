import pandas as pd
import sqlite3
import json 
import random 

conn = sqlite3.Connection('data/local.db')
df = pd.read_sql('''
    select *
    from embeddings
                 order by random() limit 5
''', conn)
print(df)
raise Exception()

# for _, row in df.iterrows():
#     print(row['article_id'])
#     print('------------------------')
#     print(row['chunk'])
#     print()
#     print('###################################################################')
#     print()




import sqlite3
import pandas as pd

connection = sqlite3.connect("data/local.db")
query = """
    SELECT chunk, chunk_id
    FROM chunks
    LIMIT 100
"""

tokens = 0
for batch_number, batch in enumerate(
    pd.read_sql_query(query, connection, chunksize=1_000),
    start=1,
):
    print(batch)
    raise Exception()
    # print(round((batch_number * 1000) / 10000, 4))
    # for text in batch.values:
    #     tokens += len(text[0].split())

print(f'Total tokens: {tokens}')
connection.close()




# with open('data/links.json', 'r') as file:
#     j = json.load(file)
# j = pd.DataFrame([
#     {'id': k, 'count': v}
#     for k, v in j.items()
# ])
# print(len(j))
# j = j.sort_values('count').tail(10)
# print(j)


# with open('data/scraped.json', 'r') as file:
#     j = json.load(file)
# print(len(j))
# keys = [key for key in j]
# keys = [random.choice(keys) for _ in range(10)]
# print([(key, j[key]) for key in keys])


# conn = sqlite3.Connection('data/local.db')
# try:
#     df = pd.read_sql('''
#         select *
#         from raw_articles
#         where redirect is not null   
#         order by random()
#         limit 10
#     ''', conn)
#     # df.to_json('data/test_articles.json')
#     print(df)
# finally:
#     conn.close()