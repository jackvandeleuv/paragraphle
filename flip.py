import time
import random

start = time.time()
coin = ['heads', 'tails']
in_a_row = 0
i = 0
while True:
    i += 1
    print("Flip...")
    time.sleep(6)
    flip = random.choice(coin)
    print(f"It was {flip}.")
    if flip == 'tails':
        in_a_row += 1
        print(f"{in_a_row} in a row!")
    else:  
        in_a_row = 0
        print("Shit.")
    if in_a_row == 9:
        print("WORLD RECORD!!!")
        print(f"It only took {(time.time() - start) / 60} minutes and {i} guesses.")
        break