"""Turn resolved JSON into the browser data files the site loads.

Writes assets/data/tracks.js and assets/data/backgrounds.js as plain globals so
index.html also works when opened directly from the filesystem (file://).

Usage: python3 tools/build_data.py
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Low-quality / off-theme / duplicate resolutions to exclude by video id.
TRACK_BLOCKLIST = {
    "7IPEcVjwxrs",  # "Main Aisa Kyon Hoon (Jammin')" – not the film version
    "da4s46NAQUM",  # random rap upload, off-vibe
    "afDxnOS4vp0",  # fan edit, poor audio
    "yccGxvIydKg",  # same composition as "Sandese Aate Hain" already in the list
}

# Curated display credits, keyed by the song name used in tools/resolve_tracks2.py.
# YouTube titles are full of promo text, so we present our own clean metadata.
CREDITS = {
    "Teri Mitti": "Kesari (2019) · B Praak",
    "Sandese Aate Hain": "Border (1997) · Sonu Nigam, Roopkumar Rathod",
    "Maa Tujhe Salaam": "Vande Mataram (1997) · A. R. Rahman",
    "Chak De India": "Chak De! India (2007) · Sukhwinder Singh",
    "Rang De Basanti": "Rang De Basanti (2006) · Daler Mehndi, A. R. Rahman",
    "Khoon Chala": "Rang De Basanti (2006) · Mohit Chauhan",
    "Lakshya Title Track": "Lakshya (2004) · Shankar-Ehsaan-Loy",
    "Kandhon Se Milte Hain Kandhe": "Lakshya (2004) · Sonu Nigam, Shankar Mahadevan",
    "Yeh Jo Des Hai Tera": "Swades (2004) · A. R. Rahman",
    "Yun Hi Chala Chal": "Swades (2004) · Udit Narayan, Kailash Kher, Hariharan",
    "Kar Har Maidaan Fateh": "Sanju (2018) · Sukhwinder Singh, Shreya Ghoshal",
    "Challa Main Lad Jaana": "Uri: The Surgical Strike (2019) · Romy, Vivek Hariharan",
    "Desh Mere": "Bhuj: The Pride of India (2021) · Arijit Singh",
    "Bharat Ki Beti": "Gunjan Saxena: The Kargil Girl (2020) · Arijit Singh",
    "Kadam Kadam Badhaye Ja": "Azad Hind Fauj regimental march",
    "Ae Mere Watan Ke Logon": "Lata Mangeshkar (1963) · C. Ramchandra",
    "Mera Mulk Mera Desh": "Diljale (1996) · Kumar Sanu, Alka Yagnik",
    "Suno Gaur Se Duniya Walon": "Dus (1997) · Shankar Mahadevan, Sukhwinder Singh",
    "I Love My India": "Pardes (1997) · Shankar Mahadevan, Hariharan, Kavita K.",
    "Des Rangila": "Fanaa (2006) · Mahalaxmi Iyer",
    "Aisa Des Hai Mera": "Veer-Zaara (2004) · Lata Mangeshkar, Udit Narayan",
    "Sarfaroshi Ki Tamanna": "The Legend of Bhagat Singh (2002) · A. R. Rahman",
    "Mera Rang De Basanti Chola": "Shaheed (1965) · Mohammed Rafi, Manna Dey",
    "Ziddi Dil": "Mary Kom (2014) · Vishal Dadlani",
    "Zinda": "Bhaag Milkha Bhaag (2013) · Siddharth Mahadevan",
    "Bhaag Milkha Bhaag": "Bhaag Milkha Bhaag (2013) · Siddharth Mahadevan",
    "Jai Hind Ki Senaa": "Shershaah (2021) · Vikram Montrose",
    "Sher Khul Gaye": "Fighter (2024) · Vishal-Sheykhar, Benny Dayal",
    "Vande Mataram (Fighter)": "Fighter (2024) · Vishal-Sheykhar",
    "Aye Mere Pyare Watan": "Kabuliwala (1961) · Manna Dey",
    "Hum Honge Kamyab": "Patriotic standard",
    "Shankara Re Shankara": "Tanhaji: The Unsung Warrior (2020) · Ajay-Atul",
    "Bharat Humko Jaan Se Pyara Hai": "Roja (1992) · A. R. Rahman, Hariharan",
    "Teri Mitti (Female)": "Kesari (2019) · Parineeti Chopra, Arko",
    "Lehra Do": "83 (2021) · Arijit Singh, Pritam",
    "Saare Jahan Se Accha": "Indian Army band · Allama Iqbal",
    "Nanha Munna Rahi Hoon": "Son of India (1962) · Shanti Mathur",
    "Jhanda Ooncha Rahe Hamara": "Patriotic standard",
    "Khalbali": "Rang De Basanti (2006) · A. R. Rahman, Nacim",
    "Roobaroo": "Rang De Basanti (2006) · Naresh Iyer, A. R. Rahman",
    "Hindustani": "Dus (1997) · Sonu Nigam, Shankar Mahadevan",
    "Vande Mataram (ABCD 2)": "ABCD 2 (2015) · Daler Mehndi, Sachin-Jigar",
    "Mard Maratha": "Panipat (2019) · Ajay-Atul",
    "Maay Bhavani": "Tanhaji: The Unsung Warrior (2020) · Shreya Ghoshal, Ajay-Atul",
    "Sanu Kehndi": "Kesari (2019) · Romy, Brijesh Shandilya",
    "Dil Diya Hai Jaan Bhi Denge": "Karma (1986) · Mohammed Aziz, Kavita K.",
    "Kargil Ka Shershah": "Captain Vikram Batra, PVC — tribute",
    "Uri Theme": "Uri: The Surgical Strike (2019) · Shashwat Sachdev",
    "Bharat Ke Veer": "Tribute to the Indian soldier",
}


def build_tracks():
    src = os.path.join(ROOT, "data", "tracks.json")
    with open(src, encoding="utf-8") as f:
        rows = json.load(f)

    out = []
    seen = set()
    for r in rows:
        if r["id"] in TRACK_BLOCKLIST or r["id"] in seen:
            continue
        seen.add(r["id"])
        song = r["song"]
        out.append({
            "id": r["id"],
            "name": song,
            "credit": CREDITS.get(song, r.get("channel", "")),
            "source": r.get("channel", ""),
            "duration": r.get("duration", 0),
        })

    dest = os.path.join(ROOT, "assets", "data", "tracks.js")
    with open(dest, "w", encoding="utf-8") as f:
        f.write("/* Curated patriotic playlist. Audio is streamed from YouTube;\n"
                "   this site hosts no audio files. Generated by tools/build_data.py */\n")
        f.write("window.SHAURYA_TRACKS = ")
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"tracks.js: {len(out)} tracks")


def build_backgrounds():
    src = os.path.join(ROOT, "data", "images.json")
    if not os.path.exists(src):
        print("images.json missing; skipping backgrounds")
        return
    try:
        with open(src, encoding="utf-8") as f:
            rows = json.load(f)
    except json.JSONDecodeError:
        print("images.json not finished writing yet; skipping backgrounds")
        return

    out = []
    for r in rows:
        label = re.sub(r"^File:", "", r.get("file", ""))
        label = re.sub(r"\.(jpg|jpeg|png|JPG|JPEG|PNG)$", "", label)
        label = re.sub(r"[_]+", " ", label)
        label = re.sub(r"\s+", " ", label).strip()
        out.append({
            "url": r["url"],
            "label": label[:110],
            "license": r.get("license", ""),
            "credit": (r.get("artist") or r.get("credit") or "").strip()[:80],
            "page": r.get("page", ""),
        })

    dest = os.path.join(ROOT, "assets", "data", "backgrounds.js")
    with open(dest, "w", encoding="utf-8") as f:
        f.write("/* Curated Indian Armed Forces backgrounds from Wikimedia Commons.\n"
                "   Freely licensed (public domain / CC / GODL-India); credits shown\n"
                "   on screen. Generated by tools/build_data.py */\n")
        f.write("window.SHAURYA_BACKGROUNDS = ")
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"backgrounds.js: {len(out)} images")


if __name__ == "__main__":
    build_tracks()
    build_backgrounds()
