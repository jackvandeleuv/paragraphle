
# import sqlite3
# import ast

# db_path = "data/data.db"
# table = "embeddings"
# id_col = "id"
# embedding_col = "vector"

# conn = sqlite3.connect(db_path)

# batch_size = 10_000


# # These can substantially improve bulk-update performance.
# conn.execute("PRAGMA journal_mode=WAL")
# conn.execute("PRAGMA synchronous=NORMAL")

# select_cur = conn.execute(
#     f"""
#     SELECT {id_col}, {embedding_col}
#     FROM {table}
#     WHERE typeof({embedding_col}) = 'text'
#     """
# )

# converted = 0

# try:
#     while True:
#         rows = select_cur.fetchmany(batch_size)
#         print('batch!kkk')

#         if not rows:
#             break

#         updates = []

#         for row_id, value in rows:
#             original_bytes = ast.literal_eval(value)

#             if not isinstance(original_bytes, bytes):
#                 raise TypeError(
#                     f"Row {row_id}: result is "
#                     f"{type(original_bytes).__name__}, not bytes"
#                 )

#             if len(original_bytes) % 2:
#                 raise ValueError(
#                     f"Row {row_id}: invalid float16 byte length "
#                     f"{len(original_bytes)}"
#                 )

#             updates.append(
#                 (sqlite3.Binary(original_bytes), row_id)
#             )

#         conn.executemany(
#             f"""
#             UPDATE {table}
#             SET {embedding_col} = ?
#             WHERE {id_col} = ?
#             """,
#             updates,
#         )

#         conn.commit()

#         converted += len(updates)
#         print(f"Converted {converted:,} rows")

# finally:
#     conn.close()


# cur = conn.cursor()
# cur.execute("select id, vector from embeddings")
# for row_id, blob in cur.fetchall():
#     if blob is None:
#         print(row_id, "NULL")
#     else:
#         print(row_id, len(blob), "bytes")

# blob = conn.execute("""
#     SELECT vector
#     FROM embeddings
#     limit 1
# """).fetchone()[0]

# print(type(blob))
# print(len(blob))
# print(repr(blob[:100]))

