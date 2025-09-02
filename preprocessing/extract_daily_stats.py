import sqlite3

DB_PATH = '/mnt/volume_nyc1_01/data.db'

conn = sqlite3.Connection(DB_PATH)
cur = conn.cursor()

try:
    for table in ['wins', 'sessions', 'guesses']:
        print(table)
        cur.execute(f"select * from {table}")
        rows = cur.fetchall()
        with open(f'./{table}.txt', 'w', encoding='utf-8') as file:
            for tup in rows:
                row_string = ''
                for val in tup:
                    row_string = row_string + str(val) + ', '
                file.write(row_string + '\n')

except Exception as e:
    print(e)
finally:
    conn.close()

