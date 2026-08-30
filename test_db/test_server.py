import requests
import pandas as pd

pd.set_option('display.max_columns', None)

URI = 'http://localhost:8000'

def errs(r):
    fail = False
    try:
        r.raise_for_status()
    except Exception as e:
        print(r.status_code)
        print(r.text)
        fail = True
    if fail:
        raise Exception('aahhh')

r = requests.get(f'{URI}/start-session')
errs(r)
s1 = r.text[1 : -2]
print(s1)

r = requests.get(f'{URI}/start-session')
errs(r)
s2 = r.text[1 : -2]
print(s2)

r = requests.get(f'{URI}/suggestion?limit=5&q=a')
errs(r)
articles = pd.DataFrame(r.json())

a1 = articles.iloc[0]['article_id']
a2 = articles.iloc[1]['article_id']

print(f"{URI}/guess-article?session_id={s1}&article_id={a2}")

r = requests.get(f"{URI}/guess-article?session_id={s1}&article_id={a2}")
errs(r)
print('s1, g1:')
print(r.json())
r = requests.get(f"{URI}/guess-article?session_id={s1}&article_id={a1}")
errs(r)
print('s1, g2:')
print(r.json())

r = requests.get(f"{URI}/guess-article?session_id={s2}&article_id={a1}")
errs(r)
print('s2, g1:')
print(r.json())
