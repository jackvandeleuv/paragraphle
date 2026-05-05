import sqlite3

conn = sqlite3.Connection('test.db')
cur = conn.cursor()

try:
    # cur.execute('drop table if exists temp_distinct_links_with_count')
    # conn.commit()
    
    # cur.execute('''
    #     create table temp_distinct_links_with_count as 
    #         select 
    #             article_id, 
    #             count(*) as link_count
    #         from (
    #             select distinct article_id, parent_article_id
    #             from links
    #         )
    #         group by article_id
    # ''')
    # conn.commit()
    # print('created: temp_distinct_links_with_count')

    cur.execute('drop table if exists suggestions')
    cur.execute('''
        create table suggestions as
            select 
                summaries.article_id, 
                title, 
                lower(title) as clean_title,
                temp_distinct_links_with_count.link_count as count
                        
            from (
                select 
                    article_id, 
                    title,
                    min(id) as id
                from summaries
                where 
                    article_id is not null and 
                    trim(article_id) != ''
                group by article_id, title
            ) as summaries
                        
            join temp_distinct_links_with_count
                on temp_distinct_links_with_count.article_id == summaries.article_id 

            join (
                select distinct article_id
                from embeddings
            ) as embeddings
                on embeddings.sentence_id == sentences.id
    ''')
    conn.commit()

    cur.execute('create index if not exists idx_suggestions_article_id on suggestions(article_id);')
    cur.execute('create index if not exists idx_suggestions_count on suggestions(count);')
    conn.commit()

finally:
    conn.close()
