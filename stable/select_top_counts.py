import pandas as pd

def select_top_counts():
    selected = {}
    with open('../transformed/data/links.txt', 'r', encoding='utf-8', errors='replace') as file:
        for line in file:
            try:
                # Filter out hashtag pages
                if line[0] == '#':
                    continue

                # Filter out category pages
                skip = False
                for substring in ['Category:', 'File:', 'Wikipedia:']:
                    if substring in line:
                        skip = True
                if skip:
                    continue
                    
                # Filter out aliases and sublinks
                for substring in ['#', '|']:
                    if substring in line:
                        line = line.split(substring, 1)[0]

                line = line.strip()

                if line in selected:
                    selected[line] += 1
                else:
                    selected[line] = 1
            except Exception as e:
                print(e)

    selected = pd.DataFrame(
        list(
            filter(
                lambda x: x['count'] >= 5,
                sorted(
                    [
                        {
                            'lower_title': x.lower().strip(), 
                            'count': y
                        } 
                        for x, y in selected.items()
                    ],
                    key=lambda x: x['count'],
                    reverse=True
                )   
            )
        )
    )

    return selected