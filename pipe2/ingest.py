import pandas as pd
import requests
import io

def get_wiki_parquet_url(idx):
    return f'https://huggingface.co/api/datasets/wikimedia/wikipedia/parquet/20231101.en/train/{idx}.parquet'

def download_wiki_parquet(idx):
    url = get_wiki_parquet_url(idx)
    print('downloading parquet...')
    (pd
        .read_parquet(io.BytesIO(requests.get(url).content))
        .rename(columns={'id': 'article_id'})
        .to_parquet(f"source/wiki_{idx}.parquet")
    )
