import pandas as pd
import sqlite3
import json 

# conn = sqlite3.Connection('data/local.db')
# df = pd.read_sql('''
#     select *
#     from links
#     limit 3
# ''', conn)

# print('df')
# print(df)

with open('links.json', 'r') as file:
    j = json.load(file)
j = pd.DataFrame([
    {'id': k, 'count': v}
    for k, v in j.items()
])
print(len(j))
j = j.sort_values('count').tail(10)
print(j)

with open('scraped.json', 'r') as file:
    j = json.load(file)
j = pd.DataFrame([
    {'id': k, 'redirect': v['redirect']}
    for k, v in j.items()
])
j = j.sample(10)
print(j)