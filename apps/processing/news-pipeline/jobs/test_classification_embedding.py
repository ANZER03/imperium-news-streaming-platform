"""
Quick sanity test: embed 10 news headlines, classify each by nearest topic
vector (cosine similarity), compare to true label.
"""
from __future__ import annotations

import json
import math
import os
import urllib.request

import psycopg

DSN = os.environ.get(
    "PHASE3_POSTGRES_DSN",
    "postgresql://postgres:postgres@localhost:35432/imperium-news-source",
)
LLAMA_URL = os.environ.get("LLAMA_CPP_BASE_URL", "http://llama-cpp:8080")
MODEL     = os.environ.get("NVIDIA_EMBEDDING_MODEL", "embeddinggemma-300M-Q8_0.gguf")

EXAMPLES = [
    # English
    ("Parliament passes new budget law amid opposition protests",          "politics_government"),
    ("Army launches offensive in northern region targeting rebel forces",   "war_security"),
    ("Central bank raises interest rates to combat rising inflation",       "business_economy"),
    ("Three arrested after armed robbery at downtown bank",                "crime_justice"),
    ("Researchers unveil AI model that outperforms humans on coding tasks", "science_technology"),
    ("New vaccine shows 94% efficacy against seasonal flu strains",        "health"),
    ("Severe flooding displaces thousands after record rainfall",          "disasters_accidents"),
    ("National football team wins championship in dramatic final",         "sports"),
    ("Award-winning film director announces new international production",  "entertainment_culture"),
    ("Carbon emissions hit record high as deforestation accelerates",      "environment_weather"),
    # French
    ("Le parlement adopte une loi controversée sur l'immigration",         "politics_government"),
    ("Des soldats déployés à la frontière après des affrontements armés",  "war_security"),
    ("La bourse de Paris chute suite à la hausse des taux d'intérêt",     "business_economy"),
    # Spanish
    ("El presidente anuncia nuevas elecciones anticipadas en el país",     "politics_government"),
    ("Terremoto de magnitud 6.8 deja decenas de muertos en la región",    "disasters_accidents"),
    ("El equipo nacional gana la Copa del Mundo en una final histórica",   "sports"),
    ("Científicos descubren nueva vacuna contra el cáncer de pulmón",      "health"),
    # Arabic
    ("أعلنت الحكومة عن خطة اقتصادية جديدة لمكافحة البطالة والتضخم",        "business_economy"),
    ("قوات الجيش تشن عملية عسكرية واسعة في المنطقة الشمالية",              "war_security"),
    ("فريق كرة القدم يحقق لقب البطولة بعد مباراة مثيرة في النهائي",        "sports"),
]


def _embed(texts: list[str]) -> list[list[float]]:
    payload = json.dumps({"model": MODEL, "input": texts}).encode()
    req = urllib.request.Request(
        f"{LLAMA_URL.rstrip('/')}/v1/embeddings",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read())
    return [item["embedding"] for item in sorted(body["data"], key=lambda x: x["index"])]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na  = math.sqrt(sum(x * x for x in a))
    nb  = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _load_topic_vectors() -> dict[str, list[float]]:
    with psycopg.connect(DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT topic_id, embedding_vector FROM imperium_topic_embeddings WHERE is_active = true"
            )
            return {row[0]: list(row[1]) for row in cur.fetchall()}


def _classify(vec: list[float], topic_vectors: dict[str, list[float]]) -> tuple[str, float]:
    best_id, best_score = "", -1.0
    for topic_id, tvec in topic_vectors.items():
        score = _cosine(vec, tvec)
        if score > best_score:
            best_score, best_id = score, topic_id
    return best_id, best_score


def main() -> None:
    print(f"Loading topic vectors from Postgres...")
    topic_vectors = _load_topic_vectors()
    print(f"  {len(topic_vectors)} topics loaded\n")

    headlines = [h for h, _ in EXAMPLES]
    print(f"Embedding {len(headlines)} headlines via llama-cpp...")
    vecs = _embed(headlines)
    print()

    LANG_RANGES = [(1, 10, "en"), (11, 13, "fr"), (14, 17, "es"), (18, 20, "ar")]

    correct = 0
    print(f"{'#':<3} {'Lang':<5} {'Predicted':<25} {'True':<25} {'Score':>6}  {'OK'}")
    print("-" * 82)
    for i, ((headline, true_label), vec) in enumerate(zip(EXAMPLES, vecs), 1):
        lang = next(lg for start, end, lg in LANG_RANGES if start <= i <= end)
        pred, score = _classify(vec, topic_vectors)
        ok = pred == true_label
        if ok:
            correct += 1
        marker = "✓" if ok else "✗"
        print(f"{i:<3} {lang:<5} {pred:<25} {true_label:<25} {score:>6.4f}  {marker}")
        if not ok:
            print(f"    headline: {headline}")

    print("-" * 82)
    print(f"Accuracy: {correct}/{len(EXAMPLES)}  ({100*correct/len(EXAMPLES):.0f}%)\n")


if __name__ == "__main__":
    main()
