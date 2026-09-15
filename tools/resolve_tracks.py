"""Resolve patriotic song queries to real, embeddable YouTube videos.

Scrapes YouTube search results, picks the best candidate, then verifies the
video exists (oEmbed) and is playable inside an iframe embed.

Usage: python3 tools/resolve_tracks.py > data/resolved.json
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

QUERIES = [
    "Teri Mitti Kesari B Praak full video song",
    "Sandese Aate Hain Border 1997 Sonu Nigam Roop Kumar Rathod song",
    "Ae Watan Raazi Arijit Singh full song",
    "Maa Tujhe Salaam Vande Mataram AR Rahman song",
    "Jai Ho Gaurav Hindustan? no",
    "Chak De India title song full video",
    "Rang De Basanti title track full song",
    "Khoon Chala Rang De Basanti full song",
    "Lakshya title song Shankar Mahadevan full",
    "Kandhon Se Milte Hain Kandhe Lakshya full song",
    "Zindagi Maut Na Ban Jaye Sarfarosh full song",
    "Ye Jo Des Hai Tera Swades AR Rahman full song",
    "Yun Hi Chala Chal Swades full song",
    "Kar Har Maidaan Fateh Sanju full song Sukhwinder",
    "Challa Main Lad Jaana Uri The Surgical Strike full song",
    "Desh Mere Bhuj The Pride Of India Arijit Singh song",
    "Bharat Ki Beti Gunjan Saxena full song",
    "Kadam Kadam Badhaye Ja INA march song",
    "Aye Mere Watan Ke Logon Lata Mangeshkar full song",
    "Mera Mulk Mera Desh Diljale full song",
    "Suno Gaur Se Duniya Walon Dus song",
    "I Love My India Pardes full song",
    "Des Rangila Fanaa full video song",
    "Aisa Des Hai Mera Veer Zaara full song",
    "Sarfaroshi Ki Tamanna The Legend of Bhagat Singh song",
    "Mera Rang De Basanti Chola Bhagat Singh song Sonu Nigam",
    "Ziddi Dil Mary Kom full song",
    "Zinda Bhaag Milkha Bhaag full song Siddharth Mahadevan",
    "Bhaag Milkha Bhaag title song full",
    "Jai Hind Ki Sena Shershaah full song",
    "Sher Khul Gaye Fighter full song Vishal Mishra",
    "Vande Mataram Fighter full song",
    "Ae Mere Pyare Watan Kabuliwala song",
    "Hum Honge Kamyab full song",
    "Shankara Re Shankara Tanhaji full song",
    "Dhoom Dhadaka Uri josh song",
    "Bharat Humko Jaan Se Pyara Hai Roja full song",
    "Jai Ho Bharat Bhagya Vidhata national anthem AR Rahman",
    "Teri Mitti Female version B Praak Parineeti",
    "Main Aisa Kyun Hoon Lakshya full song",
    "Lehra Do 83 movie full song Arijit Singh",
    "Ghar More Pardesiya no",  # placeholder guard, filtered later
    "Ae Watan Mere Watan patriotic song",
    "Rangeela Re? no",  # guard
    "Saare Jahan Se Achha patriotic song",
    "Nanha Munna Rahi Hoon song",
    "Jhanda Ooncha Rahe Hamara song",
    "Bharat Mata Ki Jai patriotic song",
    "Param Vir Chakra tribute song Indian Army",
    "Indian Army motivational song fauji",
    "Sarfira? no",  # guard
    "Jaan Tere Naam? no",  # guard
    "Dil Diya Hai Jaan Bhi Denge Karma song",
    "Watan Raazi Sunidhi? no",  # guard
    "Aasman Se Aage Mission Mangal song",
    "Malhari? no",  # guard
]

# Drop obviously bad guard entries
QUERIES = [q for q in QUERIES if "? no" not in q and not q.endswith(" no")]


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def extract_initial_data(html):
    m = re.search(r"var ytInitialData\s*=\s*(\{.*?\});</script>", html, re.S)
    if not m:
        m = re.search(r'ytInitialData"\]\s*=\s*(\{.*?\});', html, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def walk_video_renderers(node):
    """Yield every videoRenderer dict found anywhere in the response."""
    if isinstance(node, dict):
        if "videoRenderer" in node and isinstance(node["videoRenderer"], dict):
            yield node["videoRenderer"]
        for v in node.values():
            yield from walk_video_renderers(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_video_renderers(v)


def runs_text(obj):
    if not isinstance(obj, dict):
        return ""
    if "simpleText" in obj:
        return obj["simpleText"]
    return "".join(r.get("text", "") for r in obj.get("runs", []) or [])


def parse_duration(text):
    if not text:
        return 0
    parts = [p for p in text.split(":") if p.strip().isdigit()]
    if not parts:
        return 0
    secs = 0
    for p in parts:
        secs = secs * 60 + int(p)
    return secs


def search_candidates(query, limit=6):
    url = "https://www.youtube.com/results?" + urllib.parse.urlencode(
        {"search_query": query, "sp": "EgIQAQ%3D%3D"}  # filter: videos only
    )
    html = fetch(url)
    data = extract_initial_data(html)
    out = []
    if not data:
        return out
    for vr in walk_video_renderers(data):
        vid = vr.get("videoId")
        if not vid:
            continue
        title = runs_text(vr.get("title", {}))
        channel = ""
        for key in ("ownerText", "longBylineText", "shortBylineText"):
            channel = runs_text(vr.get(key, {}))
            if channel:
                break
        dur = parse_duration(runs_text(vr.get("lengthText", {})))
        if not title:
            continue
        out.append({"id": vid, "title": title, "channel": channel, "duration": dur})
        if len(out) >= limit:
            break
    return out


BAD_TITLE_BITS = (
    "reaction", "lyrics only", "karaoke", "instrumental", "ringtone", "whatsapp status",
    "status video", "shorts", "dance cover", "tutorial", "mashup of", "jukebox",
    "8d audio", "slowed", "reverb", "nightcore", "how to",
)


def score(cand):
    t = cand["title"].lower()
    c = (cand["channel"] or "").lower()
    s = 0
    if any(b in t for b in BAD_TITLE_BITS):
        s -= 50
    # Prefer proper song lengths (90s to 12min)
    if 90 <= cand["duration"] <= 720:
        s += 20
    elif cand["duration"] > 720 or cand["duration"] == 0:
        s -= 15
    # Prefer official music channels / verified topic channels
    for good in ("t-series", "zee music", "sony music", "saregama", "yrf", "tips",
                 "eros", "shemaroo", "speed records", "times music", "venus",
                 "goldmines", "ultra", "aditya music", " - topic", "official"):
        if good in c:
            s += 25
            break
    if "full video" in t or "full song" in t or "official" in t:
        s += 8
    if "video song" in t:
        s += 4
    return s


def verify(vid):
    """Return (exists, embeddable, oembed_title, oembed_author)."""
    try:
        oe = fetch(
            "https://www.youtube.com/oembed?url="
            + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}", safe="")
            + "&format=json",
            timeout=20,
        )
        meta = json.loads(oe)
    except Exception:
        return False, False, "", ""

    embeddable = False
    try:
        page = fetch(f"https://www.youtube.com/watch?v={vid}", timeout=25)
        if '"playableInEmbed":true' in page:
            embeddable = True
        elif '"playableInEmbed":false' in page:
            embeddable = False
        else:
            embeddable = True  # unknown: let the client skip it if it fails
    except Exception:
        embeddable = True

    return True, embeddable, meta.get("title", ""), meta.get("author_name", "")


def main():
    results = []
    seen = set()
    for i, q in enumerate(QUERIES, 1):
        print(f"[{i}/{len(QUERIES)}] {q}", file=sys.stderr)
        try:
            cands = search_candidates(q)
        except Exception as e:
            print(f"   search failed: {e}", file=sys.stderr)
            continue
        cands.sort(key=score, reverse=True)
        picked = None
        for c in cands:
            if c["id"] in seen:
                continue
            exists, embeddable, otitle, oauthor = verify(c["id"])
            if not exists or not embeddable:
                print(f"   skip {c['id']} exists={exists} embed={embeddable}", file=sys.stderr)
                time.sleep(0.3)
                continue
            picked = {
                "id": c["id"],
                "title": otitle or c["title"],
                "channel": oauthor or c["channel"],
                "duration": c["duration"],
                "query": q,
            }
            break
        if picked:
            seen.add(picked["id"])
            results.append(picked)
            print(f"   OK  {picked['id']}  {picked['title'][:70]}", file=sys.stderr)
        else:
            print("   NONE", file=sys.stderr)
        time.sleep(0.4)

    json.dump(results, sys.stdout, ensure_ascii=False, indent=2)
    print(f"\nResolved {len(results)} tracks", file=sys.stderr)


if __name__ == "__main__":
    main()
