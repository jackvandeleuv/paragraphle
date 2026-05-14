from ingest import download_wiki_parquet
from make_sentences import get_write_parquet_sentences
import pandas as pd

def get_popular_links_lower():
    print('loading links...')
    links = []
    with open('../preprocessing/data/links.txt', 'r', encoding='latin-1') as file:
        for line in file:
            if line.strip() != '':
                links.append(line.strip().lower())
    links = pd.DataFrame(links)
    links = links.groupby(0).size().sort_values()
    return set(links[-150000 :].index)

def get_blacklist():
    out = []
    with open('article_id_blacklist.txt', 'r') as file:
        for line in file:
            out.append(int(line.strip()))
    return out

def main():
    links = get_popular_links_lower()
    blacklist = get_blacklist()
    for idx in range(41):
        print(idx)
        download_wiki_parquet(idx)
        get_write_parquet_sentences(f'wiki_{idx}', links, blacklist)

main()