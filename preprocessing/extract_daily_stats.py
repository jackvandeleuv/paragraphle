# Migration

import sqlite3

DB_PATH = ' /mnt/volume_nyc1_01/data.db'

try:
    conn = sqlite3.Connection(DB_PATH)
    cur = conn.cursor()

    for table in ['wins', 'sessions', 'guesses']:
        cur.execute(f"select * from {table}")
        rows = cur.fetchall()
        with open(f'./{table}.txt' 'w', encoding='utf-8') as file:
            for row in rows:
                row_string = ''
                for val in row:
                    row_string = str(val) + ', '
                file.write(row_string + '\n')
            
except Exception as e:
    print(e)
finally:
    conn.close()
