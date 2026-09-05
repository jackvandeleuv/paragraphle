
# preloaded = [
#     'articles',
#     'chunks',
#     'embeddings',
#     'to_filter',
# ]
# try:
#     conn = sqlite3.connect('data.db')
#     for t in preloaded:
#         df = pd.read_csv(f'{t}.csv')
#         df.to_sql(t, conn)
#     conn.commit()
# finally:
#     conn.close()    

