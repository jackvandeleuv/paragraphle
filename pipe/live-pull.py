import requests
from bs4 import BeautifulSoup
import re
import time
import os
import spacy
# from fastembed import TextEmbedding

article_id = 'Harry_Potter'

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

def get_sentences(article_id, soup, min, max):
    sentences = extract_raw_sentences(soup, min)
    sentences = clean_sentences(sentences, min, max)
    timestamp = time.time()
    return [
        (timestamp, timestamp, sentence, sentence.split().__len__(), article_id)
        for sentence in sentences
    ]
  

import spacy
import numpy as np

nlp = spacy.load("en_core_web_sm")

text = "The dog chased the ball."
doc = nlp(text)

# Sentence/document embedding
embedding = doc.vector
print(embedding.shape)   # usually (300,)

headers = {'User-Agent': 'MyApp/1.0 (you@example.com)'}
url = f'https://en.wikipedia.org/w/rest.php/v1/page/{article_id}/html'
r = requests.get(url, headers=headers)
r.raise_for_status()
t = r.text
soup = BeautifulSoup(t)
sentences = get_sentences(article_id, soup, MIN_SENTENCE_WORDS, MAX_SENTENCE_WORDS)

start = time.time()
embeddings = [nlp(x[2]) for x in sentences]
print(len(embeddings))
print(time.time() - start)

start = time.time()
embeddings = [nlp(x[2]) for x in sentences]
print(len(embeddings))
print(time.time() - start)

start = time.time()
embeddings = [nlp(x[2]) for x in sentences]
print(len(embeddings))
print(time.time() - start)