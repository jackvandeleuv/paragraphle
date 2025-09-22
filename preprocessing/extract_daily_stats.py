import sqlite3
import csv

DB_PATH = '/mnt/volume_nyc1_01/data.db'

conn = sqlite3.Connection(DB_PATH)
cur = conn.cursor()

try:
    for table in ['wins', 'sessions', 'guesses']:
        print(f"Exporting {table}...")
        cur.execute(f"SELECT * FROM {table}")
        rows = cur.fetchall()

        column_names = [desc[0] for desc in cur.description]

        with open(f'./{table}.csv', 'w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(column_names)
            writer.writerows(rows)

except Exception as e:
    print("Error:", e)
finally:
    conn.close()
