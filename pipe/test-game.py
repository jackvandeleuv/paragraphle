#!/usr/bin/env python3

import argparse
import heapq
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError:
    TfidfVectorizer = None


TARGET_ARTICLE_CANDIDATES = [
    "Harry_Potter",
    "The_Lord_of_the_Rings",
    "Star_Wars",
    "Batman",
    "Superman",
    "Spider-Man",
    "The_Beatles",
    "Taylor_Swift",
    "Michael_Jackson",
    "Albert_Einstein",
    "Isaac_Newton",
    "Leonardo_da_Vinci",
    "William_Shakespeare",
    "United_States",
    "United_Kingdom",
    "World_War_II",
    "World_War_I",
    "Ancient_Egypt",
    "Roman_Empire",
    "Greek_mythology",
    "Moon",
    "Mars",
    "Earth",
    "Sun",
    "Solar_System",
    "Dinosaur",
    "Tyrannosaurus",
    "Blue_whale",
    "Dog",
    "Cat",
    "New_York_City",
    "London",
    "Paris",
    "Tokyo",
    "Mount_Everest",
    "Great_Wall_of_China",
    "Mona_Lisa",
    "Titanic",
    "Olympic_Games",
    "Football",
    "Basketball",
    "Chess",
    "Minecraft",
    "Facebook",
    "Google",
    "Apple_Inc.",
    "Microsoft",
    "Python_(programming_language)",
    "Artificial_intelligence",
    "Climate_change",
]

MAX_SENTENCE_WORDS = 60
MIN_SENTENCE_WORDS = 10

DEFAULT_CACHE_DIR = Path(".wiki_cache")
DEFAULT_TARGET_ARTICLE_CACHE_FILENAME = "target_article.json"
DEFAULT_GUESSED_ARTICLES_CACHE_FILENAME = "guessed_articles.json"

APP_NAME = "FastTfidfWikiGuessingGame"
APP_VERSION = "0.9"

WORD_RE = re.compile(r"\b[A-Za-z0-9][A-Za-z0-9']*\b")
SENTENCE_SPLIT_RE = re.compile(r"\.\s+")
CITATION_RE = re.compile(r"\[\d+\]")
WHITESPACE_RE = re.compile(r"\s\s+")

ANSI_RESET = "\033[0m"

LOW_RGB = (85, 85, 85)
HIGH_RGB = (255, 190, 35)


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def build_session(contact):
    contact = contact.strip()

    if not contact or contact == "replace-me@example.com":
        print(
            "Warning: please set a real contact email or project URL with "
            "--contact or WIKI_CONTACT.",
            file=sys.stderr,
        )

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": f"{APP_NAME}/{APP_VERSION} ({contact}) Python requests",
            "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
        }
    )
    return session


def seconds_from_retry_after(value):
    if not value:
        return None

    value = value.strip()

    if value.isdigit():
        return max(0, int(value))

    try:
        retry_datetime = parsedate_to_datetime(value)

        if retry_datetime.tzinfo is None:
            retry_datetime = retry_datetime.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        return max(0, int((retry_datetime - now).total_seconds()))

    except Exception:
        return None


def request_with_retries(
    session,
    url,
    *,
    response_type="text",
    max_retries=5,
    base_backoff_seconds=5,
):
    retryable_statuses = {429, 500, 502, 503, 504}
    last_response = None

    for attempt in range(max_retries):
        response = session.get(url, timeout=30)
        last_response = response

        if response.status_code not in retryable_statuses:
            response.raise_for_status()
            return response.json() if response_type == "json" else response.text

        retry_after = seconds_from_retry_after(response.headers.get("Retry-After"))

        if retry_after is not None:
            sleep_seconds = retry_after
        else:
            sleep_seconds = min(60, base_backoff_seconds * (2 ** attempt))

        print(
            f"Got HTTP {response.status_code}. "
            f"Waiting {sleep_seconds}s before retrying...",
            file=sys.stderr,
        )

        time.sleep(sleep_seconds)

    if last_response is not None:
        last_response.raise_for_status()

    raise RuntimeError(f"Request failed without a response: {url}")


def normalize_article_title(article_arg):
    return article_arg.strip().replace(" ", "_")


def encode_title_for_url(article_id):
    return quote(article_id, safe="")


def parse_html(html):
    try:
        return BeautifulSoup(html, "lxml")
    except Exception:
        return BeautifulSoup(html, "html.parser")


def get_article_soup(session, article_id):
    encoded_article_id = encode_title_for_url(article_id)
    url = f"https://en.wikipedia.org/w/rest.php/v1/page/{encoded_article_id}/html"
    html = request_with_retries(session, url, response_type="text")
    return parse_html(html)


def safe_write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = path.with_suffix(path.suffix + ".tmp")

    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    tmp_path.replace(path)


def get_target_article_cache_path(cache_dir):
    return cache_dir / DEFAULT_TARGET_ARTICLE_CACHE_FILENAME


def get_guessed_articles_cache_path(cache_dir):
    return cache_dir / DEFAULT_GUESSED_ARTICLES_CACHE_FILENAME


def fetch_article_summary_from_api(session, article_id):
    encoded_article_id = encode_title_for_url(article_id)
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_article_id}"

    data = request_with_retries(session, url, response_type="json")
    summary = data.get("extract", "").strip()

    if not summary:
        raise RuntimeError(f"{article_id} summary endpoint did not return an extract.")

    return {
        "article_id": article_id,
        "source_url": url,
        "fetched_at": time.time(),
        "fetched_at_readable": utc_now_iso(),
        "title": data.get("title"),
        "displaytitle": data.get("displaytitle"),
        "description": data.get("description"),
        "summary": summary,
    }


def choose_random_target_article():
    return random.choice(TARGET_ARTICLE_CANDIDATES)


def create_new_target_article(session, cache_dir):
    article_id = choose_random_target_article()
    summary_payload = fetch_article_summary_from_api(session, article_id)

    target_payload = {
        "version": 1,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "article_id": article_id,
        "candidate_count": len(TARGET_ARTICLE_CANDIDATES),
        "summary_payload": summary_payload,
    }

    safe_write_json(get_target_article_cache_path(cache_dir), target_payload)
    return target_payload, False


def load_or_create_target_article(
    session,
    cache_dir,
    *,
    new_game=False,
    refresh_target_summary=False,
):
    target_cache_path = get_target_article_cache_path(cache_dir)

    if new_game:
        return create_new_target_article(session, cache_dir)

    if target_cache_path.exists():
        try:
            with target_cache_path.open("r", encoding="utf-8") as f:
                target_payload = json.load(f)

            article_id = target_payload.get("article_id")
            summary_payload = target_payload.get("summary_payload") or {}
            summary = summary_payload.get("summary", "").strip()

            if article_id and summary and not refresh_target_summary:
                return target_payload, True

            if article_id and refresh_target_summary:
                target_payload["summary_payload"] = fetch_article_summary_from_api(
                    session,
                    article_id,
                )
                target_payload["updated_at"] = utc_now_iso()
                safe_write_json(target_cache_path, target_payload)
                return target_payload, False

            print(
                f"Target cache exists but is incomplete. Creating a new target: "
                f"{target_cache_path}",
                file=sys.stderr,
            )

        except json.JSONDecodeError:
            print(
                f"Target cache is not valid JSON. Creating a new target: "
                f"{target_cache_path}",
                file=sys.stderr,
            )

    return create_new_target_article(session, cache_dir)


def get_target_summary(target_payload):
    summary_payload = target_payload.get("summary_payload") or {}
    summary = summary_payload.get("summary", "").strip()

    if not summary:
        raise RuntimeError("Target article cache has no summary.")

    return summary


def get_target_article_id(target_payload):
    article_id = target_payload.get("article_id", "").strip()

    if not article_id:
        raise RuntimeError("Target article cache has no article_id.")

    return article_id


def new_guessed_articles_cache(target_article_id):
    return {
        "version": 1,
        "target_article_id": target_article_id,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "articles": {},
    }


def load_guessed_articles_cache(cache_dir, target_article_id):
    cache_path = get_guessed_articles_cache_path(cache_dir)

    if not cache_path.exists():
        return new_guessed_articles_cache(target_article_id)

    try:
        with cache_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)

        if "articles" not in payload or not isinstance(payload["articles"], dict):
            print(
                f"Guess cache was malformed. Starting a new cache: {cache_path}",
                file=sys.stderr,
            )
            return new_guessed_articles_cache(target_article_id)

        if payload.get("target_article_id") != target_article_id:
            print(
                "Existing guess cache belongs to a different target article. "
                "Starting a fresh guess cache for this game.",
                file=sys.stderr,
            )
            return new_guessed_articles_cache(target_article_id)

        return payload

    except json.JSONDecodeError:
        print(
            f"Guess cache was not valid JSON. Starting a new cache: {cache_path}",
            file=sys.stderr,
        )
        return new_guessed_articles_cache(target_article_id)


def save_guessed_articles_cache(cache_dir, guess_cache):
    guess_cache["updated_at"] = utc_now_iso()
    safe_write_json(get_guessed_articles_cache_path(cache_dir), guess_cache)


def clear_guessed_articles_cache(cache_dir):
    cache_path = get_guessed_articles_cache_path(cache_dir)

    if cache_path.exists():
        cache_path.unlink()

    print(f"Cleared guessed article cache: {cache_path}")


def clear_target_article_cache(cache_dir):
    cache_path = get_target_article_cache_path(cache_dir)

    if cache_path.exists():
        cache_path.unlink()

    print(f"Cleared target article cache: {cache_path}")


def parse_sentence(sentence, sentences, buf, min_words):
    sentence = sentence.strip()

    if not sentence:
        return

    sentence = WHITESPACE_RE.sub(" ", sentence).strip()

    if not sentence.endswith("."):
        sentence += "."

    if buf:
        sentence = " ".join(buf) + " " + sentence
        buf.clear()

    if len(sentence.split()) <= min_words:
        buf.append(sentence)
    else:
        sentences.append(sentence)


def extract_raw_sentences(soup, min_words):
    buf = []
    sentences = []

    for elem in soup.find_all("p"):
        text = elem.get_text(" ", strip=True)

        if not text or len(text) <= 10:
            continue

        text = CITATION_RE.sub(" ", text)
        text = WHITESPACE_RE.sub(" ", text).strip()

        for sentence in SENTENCE_SPLIT_RE.split(text):
            parse_sentence(sentence, sentences, buf, min_words)

    if buf:
        buf_tokens = sum(len(sent.split()) for sent in buf)

        if buf_tokens >= min_words:
            sentences.append(" ".join(buf))

    return sentences


def clean_sentences(sentences, min_words, max_words):
    out = []

    for sentence in sentences:
        words = sentence.split()

        if len(words) <= max_words:
            out.append(sentence)
            continue

        first = True

        for start in range(0, len(words), max_words):
            chunk_words = words[start:start + max_words]

            if len(chunk_words) < min_words:
                continue

            chunk = " ".join(chunk_words)

            if first:
                chunk += "..."
                first = False
            else:
                chunk = "..." + chunk

            out.append(chunk)

    return out


def get_sentences(article_id, soup, min_words, max_words):
    sentences = extract_raw_sentences(soup, min_words)
    sentences = clean_sentences(sentences, min_words, max_words)
    timestamp = time.time()

    return [
        {
            "created_at": timestamp,
            "updated_at": timestamp,
            "sentence": sentence,
            "word_count": len(sentence.split()),
            "article_id": article_id,
        }
        for sentence in sentences
    ]


def fetch_and_process_guessed_article(session, article_id):
    soup = get_article_soup(session, article_id)

    rows = get_sentences(
        article_id,
        soup,
        MIN_SENTENCE_WORDS,
        MAX_SENTENCE_WORDS,
    )

    sentences = [row["sentence"] for row in rows]

    if not sentences:
        raise RuntimeError(f"No sentences extracted from {article_id}")

    return sentences


def get_or_fetch_guessed_article(
    session,
    cache_dir,
    guess_cache,
    article_id,
    *,
    refresh_article=False,
    request_delay_seconds=0.25,
):
    articles = guess_cache["articles"]
    cached_article = articles.get(article_id)

    if cached_article and not refresh_article:
        cached_article["last_guessed_at"] = utc_now_iso()
        save_guessed_articles_cache(cache_dir, guess_cache)
        return cached_article, True

    if request_delay_seconds > 0:
        time.sleep(request_delay_seconds)

    sentences = fetch_and_process_guessed_article(session, article_id)

    article_payload = {
        "article_id": article_id,
        "fetched_at": utc_now_iso(),
        "last_guessed_at": utc_now_iso(),
        "sentence_count": len(sentences),
        "sentences": sentences,
    }

    articles[article_id] = article_payload
    save_guessed_articles_cache(cache_dir, guess_cache)

    return article_payload, False


def build_global_sentence_corpus(guess_cache):
    article_ids = []
    sentences = []

    for article_id, article_payload in guess_cache["articles"].items():
        for sentence in article_payload.get("sentences", []):
            article_ids.append(article_id)
            sentences.append(sentence)

    return article_ids, sentences


def interpolate_rgb(low_rgb, high_rgb, intensity):
    intensity = max(0.0, min(1.0, intensity))

    return tuple(
        int(low + (high - low) * intensity)
        for low, high in zip(low_rgb, high_rgb)
    )


def ansi_color_text(text, intensity, *, use_color=True):
    if not use_color:
        return text

    r, g, b = interpolate_rgb(LOW_RGB, HIGH_RGB, intensity)
    return f"\033[38;2;{r};{g};{b}m{text}{ANSI_RESET}"


def get_unigram_token_scores(query_vector, document_vector, feature_names):
    contribution_vector = document_vector.multiply(query_vector)
    contribution_coo = contribution_vector.tocoo()

    token_scores = {}

    for feature_index, contribution in zip(contribution_coo.col, contribution_coo.data):
        if contribution <= 0:
            continue

        term = feature_names[feature_index]

        # Bigrams affect scoring, but terminal coloring is word-by-word.
        if " " in term:
            continue

        term = term.lower()

        previous = token_scores.get(term)

        if previous is None or contribution > previous:
            token_scores[term] = float(contribution)

    return token_scores


def normalize_scores_for_sentence(token_scores):
    if not token_scores:
        return {}

    max_score = max(token_scores.values())

    if max_score <= 0:
        return {}

    return {
        token: score / max_score
        for token, score in token_scores.items()
    }


def color_sentence_by_token_scores(sentence, token_scores, *, use_color=True):
    normalized_scores = normalize_scores_for_sentence(token_scores)

    def replace_word(match):
        word = match.group(0)
        intensity = normalized_scores.get(word.lower(), 0.0)
        return ansi_color_text(word, intensity, use_color=use_color)

    return WORD_RE.sub(replace_word, sentence)


def top_token_score_pairs(token_scores, top_n=8):
    if not token_scores:
        return []

    return heapq.nlargest(
        top_n,
        token_scores.items(),
        key=lambda item: item[1],
    )


def make_result_row(
    index,
    score,
    article_ids,
    sentences,
    query_vector,
    document_vectors,
    feature_names,
    *,
    use_color,
):
    sentence = sentences[index]
    document_vector = document_vectors[index]

    token_scores = get_unigram_token_scores(
        query_vector,
        document_vector,
        feature_names,
    )

    return {
        "score": float(score),
        "article_id": article_ids[index],
        "sentence": sentence,
        "colored_sentence": color_sentence_by_token_scores(
            sentence,
            token_scores,
            use_color=use_color,
        ),
        "token_scores": token_scores,
        "top_token_scores": top_token_score_pairs(token_scores, top_n=8),
        "doc_index": index,
    }


def select_top_indices(scores, candidate_indices, n):
    if n <= 0:
        return []

    candidate_indices = list(candidate_indices)

    if not candidate_indices:
        return []

    return heapq.nlargest(
        min(n, len(candidate_indices)),
        candidate_indices,
        key=lambda idx: scores[idx],
    )


def score_tfidf_cosine_fast(
    query_text,
    article_ids,
    sentences,
    *,
    overall_top_n=2,
    article_top_n=2,
    current_article_id=None,
    use_color=True,
    max_features=75000,
):
    if TfidfVectorizer is None:
        raise RuntimeError(
            "Missing dependency: scikit-learn. Install it with: pip install scikit-learn"
        )

    if not sentences:
        return [], []

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=1,
        max_features=max_features,
        sublinear_tf=True,
        norm="l2",
        token_pattern=r"(?u)\b[A-Za-z0-9][A-Za-z0-9']*\b",
        dtype="float32",
    )

    try:
        matrix = vectorizer.fit_transform([query_text] + sentences)
    except ValueError as exc:
        raise RuntimeError(
            f"Could not build TF-IDF vocabulary. Original error: {exc}"
        ) from exc

    query_vector = matrix[0]
    document_vectors = matrix[1:]
    feature_names = vectorizer.get_feature_names_out()

    # Since vectors are L2-normalized, sparse dot product equals cosine similarity.
    scores = (document_vectors @ query_vector.T).toarray().ravel()

    overall_indices = select_top_indices(
        scores,
        range(len(sentences)),
        overall_top_n,
    )

    current_article_indices = (
        i for i, article_id in enumerate(article_ids)
        if article_id == current_article_id
    )

    article_indices = select_top_indices(
        scores,
        current_article_indices,
        article_top_n,
    )

    # Only build colored rows for the small number of rows that will be printed.
    overall_results = [
        make_result_row(
            index,
            scores[index],
            article_ids,
            sentences,
            query_vector,
            document_vectors,
            feature_names,
            use_color=use_color,
        )
        for index in overall_indices
    ]

    article_results = [
        make_result_row(
            index,
            scores[index],
            article_ids,
            sentences,
            query_vector,
            document_vectors,
            feature_names,
            use_color=use_color,
        )
        for index in article_indices
    ]

    return overall_results, article_results


def score_guess(
    session,
    guessed_article_id,
    *,
    cache_dir,
    overall_top_n=2,
    article_top_n=2,
    use_color=True,
    new_game=False,
    refresh_target_summary=False,
    refresh_article=False,
    request_delay_seconds=0.25,
    max_features=75000,
):
    target_payload, used_target_cache = load_or_create_target_article(
        session,
        cache_dir,
        new_game=new_game,
        refresh_target_summary=refresh_target_summary,
    )

    target_article_id = get_target_article_id(target_payload)
    target_summary = get_target_summary(target_payload)

    target_cache_path = get_target_article_cache_path(cache_dir)

    print("Loaded hidden target article.")
    print(f"Target cache: {target_cache_path}")

    if used_target_cache:
        print("Using existing target from disk.")
    else:
        print("Created or refreshed target and wrote it to disk.")

    guess_cache = load_guessed_articles_cache(cache_dir, target_article_id)

    print()
    print(f"Loading guessed article: {guessed_article_id}")

    article_payload, used_article_cache = get_or_fetch_guessed_article(
        session,
        cache_dir,
        guess_cache,
        guessed_article_id,
        refresh_article=refresh_article,
        request_delay_seconds=request_delay_seconds,
    )

    if used_article_cache:
        print(f"Using cached guessed article data for: {guessed_article_id}")
    else:
        print(f"Fetched and cached guessed article data for: {guessed_article_id}")

    print(f"Sentence count for {guessed_article_id}: {article_payload['sentence_count']}")

    article_ids, sentences = build_global_sentence_corpus(guess_cache)

    overall_results, current_article_results = score_tfidf_cosine_fast(
        target_summary,
        article_ids,
        sentences,
        overall_top_n=overall_top_n,
        article_top_n=article_top_n,
        current_article_id=guessed_article_id,
        use_color=use_color,
        max_features=max_features,
    )

    exact_match = guessed_article_id.lower() == target_article_id.lower()

    return {
        "target_article_id": target_article_id,
        "guessed_article_id": guessed_article_id,
        "article_count": len(guess_cache["articles"]),
        "sentence_count": len(sentences),
        "overall_results": overall_results,
        "current_article_results": current_article_results,
        "exact_match": exact_match,
    }


def print_ranked_rows(title, rows):
    print()
    print(title)
    print("=" * 80)

    if not rows:
        print("No results.")
        return

    for i, row in enumerate(rows, start=1):
        print()
        print(f"{i}. Score: {row['score']:.4f}")
        print(f"Article: {row['article_id']}")

        top_token_scores = row.get("top_token_scores") or []

        if top_token_scores:
            readable_scores = ", ".join(
                f"{token}={score:.4f}"
                for token, score in top_token_scores
            )
            print(f"Strongest token scores: {readable_scores}")
        else:
            print("Strongest token scores: none")

        print()
        print(row.get("colored_sentence") or row["sentence"])
        print("-" * 80)


def print_result_summary(result, *, reveal_target=False):
    print()
    print(
        f"Scored with fast TF-IDF cosine similarity against the hidden target "
        f"summary using {result['article_count']} guessed article(s) "
        f"and {result['sentence_count']} total sentence(s)."
    )

    if reveal_target:
        print(f"Hidden target article: {result['target_article_id']}")

    if result["exact_match"]:
        print()
        print("Correct guess! You guessed the hidden target article.")

    print_ranked_rows(
        "Top 2 overall sentences across all guessed articles",
        result["overall_results"],
    )

    print_ranked_rows(
        f"Top 2 sentences from current guessed article: {result['guessed_article_id']}",
        result["current_article_results"],
    )


def print_candidate_articles():
    print("Possible hidden target articles:")
    print()

    for i, article_id in enumerate(TARGET_ARTICLE_CANDIDATES, start=1):
        print(f"{i:2}. {article_id}")


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Pick a random hidden target article from 50 famous Wikipedia articles, "
            "persist it to disk, then let the user guess Wikipedia articles. "
            "Each guess is scored against the hidden target summary using a faster "
            "TF-IDF cosine implementation. Displayed sentences color every word "
            "by token-level contribution score."
        )
    )

    parser.add_argument(
        "article",
        nargs="*",
        help=(
            "Your guessed English Wikipedia article title. "
            "Examples: Boron, Batman, 'The Lord of the Rings', "
            "'Python programming language'"
        ),
    )

    parser.add_argument(
        "--overall-top",
        type=int,
        default=2,
        help="Number of overall top sentences to show. Default: 2.",
    )

    parser.add_argument(
        "--article-top",
        type=int,
        default=2,
        help="Number of top sentences from the current article to show. Default: 2.",
    )

    parser.add_argument(
        "--new-game",
        action="store_true",
        help=(
            "Pick a new random hidden target article and reset the guessed-article "
            "cache for that target."
        ),
    )

    parser.add_argument(
        "--refresh-target-summary",
        action="store_true",
        help="Refetch the current hidden target summary from Wikipedia.",
    )

    parser.add_argument(
        "--refresh-article",
        action="store_true",
        help="Refetch the guessed article even if it already exists in the guess cache.",
    )

    parser.add_argument(
        "--clear-guesses",
        action="store_true",
        help="Clear guessed article cache and exit unless an article is also provided.",
    )

    parser.add_argument(
        "--clear-target",
        action="store_true",
        help="Clear the persisted hidden target and exit unless an article is also provided.",
    )

    parser.add_argument(
        "--reveal-target",
        action="store_true",
        help="Print the hidden target article after scoring.",
    )

    parser.add_argument(
        "--list-targets",
        action="store_true",
        help="Show the 50 possible hidden target articles.",
    )

    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI terminal colors.",
    )

    parser.add_argument(
        "--cache-dir",
        default=str(DEFAULT_CACHE_DIR),
        help="Directory for cache files. Default: .wiki_cache",
    )

    parser.add_argument(
        "--contact",
        default=os.environ.get("WIKI_CONTACT", "replace-me@example.com"),
        help=(
            "Contact email or project URL for the Wikimedia User-Agent. "
            "Can also be set with WIKI_CONTACT."
        ),
    )

    parser.add_argument(
        "--request-delay",
        type=float,
        default=0.25,
        help=(
            "Seconds to wait before fetching a guessed article from Wikipedia. "
            "Default: 0.25"
        ),
    )

    parser.add_argument(
        "--max-features",
        type=int,
        default=75000,
        help=(
            "Maximum TF-IDF features to keep. Lower is faster; higher may be more "
            "accurate. Default: 75000."
        ),
    )

    args = parser.parse_args()

    if args.overall_top <= 0:
        print("Error: --overall-top must be greater than 0.", file=sys.stderr)
        sys.exit(1)

    if args.article_top <= 0:
        print("Error: --article-top must be greater than 0.", file=sys.stderr)
        sys.exit(1)

    if args.request_delay < 0:
        print("Error: --request-delay cannot be negative.", file=sys.stderr)
        sys.exit(1)

    if args.max_features <= 0:
        print("Error: --max-features must be greater than 0.", file=sys.stderr)
        sys.exit(1)

    cache_dir = Path(args.cache_dir)

    if args.list_targets:
        print_candidate_articles()
        return

    if args.clear_guesses:
        clear_guessed_articles_cache(cache_dir)

        if not args.article:
            return

    if args.clear_target:
        clear_target_article_cache(cache_dir)
        clear_guessed_articles_cache(cache_dir)

        if not args.article:
            return

    if args.new_game:
        clear_guessed_articles_cache(cache_dir)

    if not args.article:
        print("Error: please provide a Wikipedia article title to guess.", file=sys.stderr)
        print(
            "Examples: Boron, Batman, 'The Lord of the Rings', "
            "'Python programming language'",
            file=sys.stderr,
        )
        print()
        print("Use --new-game with a guess to start a fresh target.")
        print("Use --list-targets to see the possible hidden target articles.")
        sys.exit(1)

    guessed_article_id = normalize_article_title(" ".join(args.article))
    session = build_session(args.contact)

    use_color = not args.no_color and "NO_COLOR" not in os.environ

    try:
        result = score_guess(
            session,
            guessed_article_id,
            cache_dir=cache_dir,
            overall_top_n=args.overall_top,
            article_top_n=args.article_top,
            use_color=use_color,
            new_game=args.new_game,
            refresh_target_summary=args.refresh_target_summary,
            refresh_article=args.refresh_article,
            request_delay_seconds=args.request_delay,
            max_features=args.max_features,
        )

        print_result_summary(result, reveal_target=args.reveal_target)

    except requests.HTTPError as exc:
        response = exc.response

        if response is not None and response.status_code == 404:
            print(
                f"Error: Wikipedia article not found: {guessed_article_id}",
                file=sys.stderr,
            )
            print(
                "Try the exact Wikipedia title, for example: "
                "'Python programming language' instead of just Python.",
                file=sys.stderr,
            )
        else:
            print(f"HTTP error: {exc}", file=sys.stderr)

        sys.exit(1)

    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()