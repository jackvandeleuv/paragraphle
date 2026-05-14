import re
import time
import pandas as pd 

MAX_SENTENCE_WORDS = 60
MIN_SENTENCE_WORDS = 10

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

def extract_raw_sentences(page, min):
    buf = []
    sentences = []

    for text in page.split('.'):
        text = text.strip()
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

def get_sentences(text, min, max):
    sentences = extract_raw_sentences(text, min)
    sentences = clean_sentences(sentences, min, max)
    return sentences

def get_write_parquet_sentences(file_name, links, blacklist):
    print('get write parquet sentences...')
    df = pd.read_parquet(f'source/{file_name}.parquet')
    df['title_lower'] = df.title.apply(lambda x: x.lower())
    df = df[df.title_lower.isin(links)]
    df = df[~df.article_id.isin(blacklist)].copy()
    
    out = []
    for _, row in df.iterrows():
        for sentence in get_sentences(row['text'], MIN_SENTENCE_WORDS, MAX_SENTENCE_WORDS):
            out.append({
                'article_id': row['article_id'],
                'sentence': sentence,
            })
    pd.DataFrame(out).to_csv(f'transformed/{file_name}_sentences.csv', index=False)