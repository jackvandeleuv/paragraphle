from scrape import scrape
import time 
def main():
    N_TO_SCRAPE = 100000
    BATCH_SIZE = 500

    start = time.time()
    scrape(N_TO_SCRAPE, BATCH_SIZE)
    print(f"Time to scrape: {round(time.time() - start, 2)}")

if __name__ == '__main__':
    main()