import numpy as np

# Scrape module
N_BATCHES = 3
BATCH_SIZE = 20

# Clean articles module.
CHUNK_WORDS_MAX = 60
CHUNK_WORDS_MIN = 10

# Embed module
MODEL = "text-embedding-3-small"
EMBED_DIM = 256
CHUNKS_PER_BATCH = 1000
COST_PER_TOKEN = 1 / (62500 * 800)