import requests
import pandas as pd
# import sqlite3
from reset import reset_user_tables

pd.set_option('display.max_columns', None)

AID_WIN = 290
AID_1 = 717
AID_2 = 863

# RESET USER TABLES
print('resetting user tables')
reset_user_tables()

# conn = sqlite3.connect("data/data.db")

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

def start_session() -> str:
    print('starting a session')
    r = requests.get(f'{URI}/start-session')
    errs(r)
    session_id = r.text[1 : -2]
    return session_id

def get_suggestions():
    r = requests.get(f'{URI}/suggestion?limit=5&q=a')
    errs(r)
    return r.json()

def test_suggestions():
    print('testing suggestions')
    s = get_suggestions()
    assert len(s) > 0, 'empty json'
    expected_keys = [
        'article_id', 'title', 'clean_title', 'count'
    ]
    for key in expected_keys:
        assert key in s[0], f'missing field: {key}'

def guess_article(aid, sid):
    r = requests.get(f"{URI}/guess-article?session_id={sid}&article_id={aid}")
    errs(r)
    return r.json()

def test_basic_guess_flow():
    aid1 = AID_1
    aid2 = AID_2

    sid = start_session()
    result = guess_article(aid1, sid)

    assert result['guesses'] == 1
    assert result['last_guess_article_id'] == aid1
    assert result['is_win'] == False

    result2 = guess_article(aid2, sid)
    assert result2['guesses'] == 2
    assert result2['last_guess_article_id'] == aid2
    assert result2['is_win'] == False

def test_first_place():
    aid1 = AID_WIN
    sid = start_session()

    result = guess_article(aid1, sid)
    assert result['is_win'] == True
    assert result['win_rank'] == 1
    restored = restore_session(sid)
    assert restored['is_win'] == True
    assert restored['win_rank'] == 1

    return sid

def test_second_place():
    aid1 = AID_1
    aid2 = AID_WIN
    sid = start_session()

    result = guess_article(aid1, sid)
    assert result['is_win'] == False
    assert result['win_rank'] == -1 
    restored = restore_session(sid)
    assert restored['is_win'] == False
    assert restored['win_rank'] == -1

    result = guess_article(aid2, sid)
    assert result['is_win'] == True
    assert result['win_rank'] == 2 
    restored2 = restore_session(sid)
    assert restored2['is_win'] == True
    assert restored2['win_rank'] == 2

    return sid

def restore_session(sid):
    r = requests.get(f"{URI}/restore-session?session_id={sid}")
    errs(r)
    return r.json()


test_suggestions()

test_basic_guess_flow()

sid1 = test_first_place()
sid2 = test_second_place()
