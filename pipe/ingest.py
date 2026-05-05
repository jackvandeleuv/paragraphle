from bs4 import BeautifulSoup
import re
import time
import sqlite3
import requests
import random
import asyncio
import aiohttp
import urllib 
import sys

failures = 0
lock = asyncio.Lock()

STARTER_BATCH = [
    'Jupiter', 'Cat', 'Aristotle', 'Tennis', 'Heat',
    'The_Office_(American_TV_series)', 'China', 'Star_Trek', 'Soup', 'Key',
    'Mars', 'Saturn', 'Earth', 'Moon', 'Sun', 'Milky_Way', 'Black_hole', 'Solar_System',
    'International_Space_Station', 'NASA',
    'DNA', 'Evolution', 'Quantum_mechanics', 'Relativity', 'Periodic_table', 'Photosynthesis',
    'Climate_change', 'Vaccination', 'Cancer',
    'Artificial_intelligence', 'Machine_learning', 'Internet', 'World_Wide_Web', 'Bitcoin',
    'Python_(programming_language)', 'Linux',
    'Microsoft', 'Google', 'Apple_Inc.', 'Amazon_(company)', 'Facebook', 'YouTube', 'Netflix',
    'Tesla,_Inc.', 'SpaceX',
    'New_York_City', 'Paris', 'London', 'Tokyo', 'Sydney', 'Cairo', 'Rio_de_Janeiro',
    'Mount_Everest', 'Grand_Canyon', 'Great_Wall_of_China',
    'Eiffel_Tower', 'Statue_of_Liberty', 'Antarctica', 'Sahara', 'Amazon_rainforest', 'Himalayas',
    'Niagara_Falls', 'Pacific_Ocean',
    'World_War_II', 'French_Revolution', 'American_Civil_War', 'Renaissance', 'Industrial_Revolution',
    'Cold_War', 'Moon_landing', 'United_Nations',
    'Star_Wars', 'Harry_Potter', 'The_Lord_of_the_Rings', 'Marvel_Cinematic_Universe',
    'Game_of_Thrones', 'The_Simpsons', 'Breaking_Bad', 'Friends', 'Stranger_Things', 'Inception',
    'The_Godfather', 'Mona_Lisa', 'The_Beatles', 'Jazz', 'Classical_music', 'K-pop',
    'Pizza', 'Sushi', 'Chocolate', 'Coffee', 'Tea', 'Hamburger', 'Pasta', 'Ice_cream', 'Taco',
    'Curry', 'Chess', 'Minecraft'
]

def insert_thumbnail(article_id, src, width, height, conn):
    cur = conn.cursor()
    timestamp = get_timestamp()
    cur.execute('''
        insert into thumbnails (created, modified, article_id, src, width, height) values (?, ?, ?, ?, ?, ?)
    ''', (timestamp, timestamp, article_id, src, width, height))
    conn.commit()

def extract_insert_sentences_thumbnail(soup, conn, article_id):
    for elem in soup.find_all('img'):
        height = int(elem.get('height', 0))
        width = int(elem.get('width', 0))
        size = height * width
        if size < 200*200 or size > 800*800:
            continue
        else:
            src = elem.get('src')
            insert_thumbnail(article_id, src, width, height, conn)
            return

# def extract_insert_summary_thumbnail(json_obj, conn, article_id):
#     thumbnail_obj = json_obj.get('thumbnail', {})
#     src = thumbnail_obj.get('source')
#     height = int(thumbnail_obj.get('height', 0))
#     width = int(thumbnail_obj.get('width', 0))
#     size = height * width
#     if size < 200*200 or size > 800*800:
#         return
#     else:
#         insert_thumbnail(article_id, src, width, height, conn)

def get_timestamp():
    return int(time.time() * 1000)

async def get_soup(href, session, sem):
    headers = {'User-Agent': 'MyApp/1.0 (you@example.com)'}
    url = f'https://en.wikipedia.org/w/rest.php/v1/page/{href}/html'

    async with sem:
        async with session.get(url, headers=headers) as response:
            response.raise_for_status()
            soup = BeautifulSoup(await response.text(), features="html.parser")
            print(f'Got soup for: {href}')
            return soup
        
def table_is_empty(cur, table):
    cur.execute(f'''
        select 1
        from {table}
        limit 1
    ''')
    return len(cur.fetchall()) == 0

def get_new_summary_batch(cur, n):
    cur.execute(f'''
        select 
            unique_sentences.article_id
        from (
            select distinct article_id
            from sentences
        ) as unique_sentences               
        join (
            select 
                article_id, 
                count(*) as link_count
            from (
                select distinct parent_article_id, article_id
                from links
            )
            group by article_id
        ) as link_counts
            on unique_sentences.article_id == link_counts.article_id
        left join summaries
            on unique_sentences.article_id == summaries.article_id
        where summaries.id is null
        limit {n}
    ''')
    new = set([x[0] for x in cur.fetchall()])

    return new

def get_new_sentence_batch(cur, n, is_explore):
    if is_explore:
        cur.execute(f'''
            select distinct links.article_id
            from links 
            left join sentences
                on sentences.article_id == links.article_id
            where sentences.article_id is null
            order by random()
            limit {n}
        ''')
    else:
        cur.execute(f'''
            select links.article_id as article_id
            from links 
            left join sentences
                on sentences.article_id == links.article_id
            where sentences.article_id is null
            group by links.article_id
            order by count(*) desc
            limit {n}
        ''')

    new = set([x[0] for x in cur.fetchall()])

    return new
    
def get_new_batch_to_fetch(cur, n, is_explore, table):
    print('\nMode:', 'explore' if is_explore else 'exploit')
    if table == 'sentences':
        return get_new_sentence_batch(cur, n, is_explore)
    elif table == 'summaries':
        return get_new_summary_batch(cur, n)
    else:
        raise ValueError('invalid mode:', table)

def parse_links(soup, article_id, conn):
    refs = []
    for elem in soup.find_all('a'):
        if elem.get('rel', [''])[0] != 'mw:WikiLink':
            continue

        href = elem.get('href', None)
        if not href or ':' in href or '?' in href or '#' in href:
            continue

        timestamp = get_timestamp()
        refs.append((
            timestamp,
            timestamp,
            article_id, 
            href.lstrip('./')
        ))

    cur = conn.cursor()
    cur.executemany('''
        insert into links (created, modified, parent_article_id, article_id) values (?, ?, ?, ?)
    ''', refs)
    conn.commit()

def parse_sentence(sentence, sentences, buf, min):
    if sentence.strip() == '':
        return
    sentence = re.sub(r"\s\s+", ' ', sentence).strip()
    if not sentence.endswith('.'):
        sentence = sentence + '.'

    if buf:
        sentence = ' '.join(buf) + ' ' + sentence
        buf.clear()

    if sentence.split().__len__() <= min:
        buf.append(sentence)
    else:
        sentences.append(sentence)

def extract_raw_sentences(soup, min):
    buf = []
    sentences = []

    for elem in soup.find_all('p'):
        text = elem.text.strip()
        if text == '' or len(text) <= 10:
            continue

        text = re.sub(r"\[\d+\]", ' ', text)

        for sentence in text.split('. '):
            parse_sentence(sentence, sentences, buf, min)

    if buf:
        buf_tokens = sum([len(sent.split()) for sent in buf])
        if buf_tokens >= min:
            sentences.append(' '.join(buf))
    
    return sentences

def clean_sentences(sentences, min, max):
    out = []
    for sentence in sentences:
        if len(sentence.split()) <= max:
            out.append(sentence)
            continue

        buf = []
        first = True
        for word in sentence.split():
            buf.append(word)
            if len(buf) >= max:
                chunk = ' '.join(buf)
                if first:
                    chunk = chunk + '...'
                else:
                    chunk = '...' + chunk
                first = False
                out.append(chunk)
                buf = []

        if len(buf) >= min:
            out.append('...' + ' '.join(buf))
    
    return out

def insert_sentences(article_id, soup, conn, min, max):
    cur = conn.cursor()
    sentences = extract_raw_sentences(soup, min)
    sentences = clean_sentences(sentences, min, max)
    timestamp = get_timestamp()
    sentences = [
        (timestamp, timestamp, sentence, sentence.split().__len__(), article_id)
        for sentence in sentences
    ]
  
    cur.executemany('''
        insert into sentences (created, modified, sentence, tokens, article_id) values (?, ?, ?, ?, ?)
    ''', sentences)
    conn.commit()

async def get_insert_summary(article_id, conn, session, sem):
    headers = {'User-Agent': 'MyApp/1.0 (you@example.com)'}
    url = f'https://en.wikipedia.org/api/rest_v1/page/summary/{article_id}'

    async with sem: 
        async with session.get(url, headers=headers) as response:
            response.raise_for_status()
            r_json = await response.json()
            title = r_json.get('title')
            description = r_json.get('description')
            extract = r_json.get('extract')

            timestamp = get_timestamp()
            data = (timestamp, timestamp, title, description, extract, article_id)

            cur = conn.cursor()
            cur.execute(
                'insert into summaries (created, modified, title, description, extract, article_id) values (?, ?, ?, ?, ?, ?)', 
                data
            )
            conn.commit()
            print('Got summary for:', article_id)

async def handle_failures(e, name):
    global failures
    print()
    print(e)
    async with lock:
        failures += 1
    print(f'^{name} failed: Sleeping {3 ** failures} seconds.')
    time.sleep(3 ** failures) 

async def get_write_sentences(article_id, conn, session, sem, min, max):
    global failures

    try:
        soup = await get_soup(article_id, session, sem)
    except Exception as e:
        await handle_failures(e, 'get_soup')
        return

    parse_links(soup, article_id, conn)
    insert_sentences(article_id, soup, conn, min, max)
    extract_insert_sentences_thumbnail(soup, conn, article_id)
    
    async with lock:
        failures = 0

async def get_write_summaries(article_id, conn, session, sem):
    global failures

    try:
        await get_insert_summary(article_id, conn, session, sem)
    except Exception as e:
        await handle_failures(e, 'get_insert_summary')
        return
    
    async with lock:
        failures = 0


async def main(conn, mode):
    MAX_SENTENCE_WORDS = 60
    MIN_SENTENCE_WORDS = 30
    N_BATCHES = 1
    EXPLORE_PERCENT = 0

    batch_size = 1
    max_promises = 500 if mode == 'sentences' else 600
    max_concurrent = 5 if mode == 'sentences' else 1

    total_processed = 0
    start = time.time()

    cur = conn.cursor()

    new_batch = STARTER_BATCH if table_is_empty(cur, mode) else []

    for _ in range(N_BATCHES):
        if not new_batch:
            explore = random.random() < EXPLORE_PERCENT if mode == 'sentences' else False
            new_batch = get_new_batch_to_fetch(cur, batch_size, explore, mode)

        sem = asyncio.Semaphore(max_concurrent)  
        async with aiohttp.ClientSession() as session:
            while new_batch:
                promises = []
                for _ in range(max_promises):
                    if not new_batch:
                        break
                    article_id = new_batch.pop()
                    if mode == 'summaries':
                        promises.append(get_write_summaries(article_id, conn, session, sem))
                    else:
                        promises.append(get_write_sentences(article_id, conn, session, sem, MIN_SENTENCE_WORDS, MAX_SENTENCE_WORDS))
                await asyncio.gather(*promises)

                total_processed += len(promises)

                print('\n\n\n\n')
                print('########################################################')
                print('\nprocess time so far:', round(time.time() - start, 2))
                print('\narticles processed so far:', total_processed)
                print('articles per second across all batches:', round(total_processed / (time.time() - start), 2))
                print('articles remaining in new_batch:', len(new_batch))
                print('########################################################')
                print('\n\n\n\n')

"""
You need to get sentences before you can get summaries, as sentences mode also retrieves links.
"""
if __name__ == '__main__':

    try:
        conn = sqlite3.Connection('test.db')
        assert len(sys.argv) > 1, 'missing required argument: mode'
        mode = sys.argv[1]
        assert mode in ('summaries', 'sentences'), 'invalid mode'
        asyncio.run(main(conn, mode))
    finally:
        conn.close()

