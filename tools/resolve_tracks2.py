"""Second pass: resolve each song with strict title validation.

A candidate is only accepted if the resolved YouTube title actually contains
the expected song-name tokens, which prevents YouTube's search from
substituting a different song from the same movie.

Usage: python3 tools/resolve_tracks2.py > data/tracks.json
"""

import json
import re
import sys
import time
import unicodedata

from resolve_tracks import fetch, search_candidates, score, verify  # noqa: E402

# Each song: name, query, must = list of groups; every group needs >=1 hit.
SONGS = [
    ("Teri Mitti", "Teri Mitti Kesari B Praak full song", [["teri mitti"]]),
    ("Sandese Aate Hain", "Sandese Aate Hain Border 1997 Sonu Nigam full song", [["sandese"]]),
    ("Ae Watan", "Ae Watan Raazi full video song Sunidhi Chauhan", [["ae watan"]]),
    ("Maa Tujhe Salaam", "Maa Tujhe Salaam A R Rahman Vande Mataram official video", [["maa tujhe salaam", "vande mataram"]]),
    ("Chak De India", "Chak De India title song Sukhwinder Singh YRF", [["chak de"]]),
    ("Rang De Basanti", "Rang De Basanti title track A R Rahman Daler Mehndi", [["rang de basanti"]]),
    ("Khoon Chala", "Khoon Chala Rang De Basanti Mohit Chauhan", [["khoon chala"]]),
    ("Lakshya Title Track", "Lakshya title track Shankar Ehsaan Loy Excel Movies", [["lakshya"]]),
    ("Kandhon Se Milte Hain Kandhe", "Kandhon Se Milte Hain Kandhe Lakshya Sonu Nigam", [["kandhon"]]),
    ("Zindagi Maut Na Ban Jaye", "Zindagi Maut Na Ban Jaye Sarfarosh Sonu Nigam", [["zindagi maut"]]),
    ("Yeh Jo Des Hai Tera", "Yeh Jo Des Hai Tera Swades A R Rahman full song", [["des hai tera"]]),
    ("Yun Hi Chala Chal", "Yun Hi Chala Chal Swades Udit Narayan Kailash Kher", [["chala chal"]]),
    ("Kar Har Maidaan Fateh", "Kar Har Maidaan Fateh Sanju Sukhwinder Shreya", [["maidaan fateh"]]),
    ("Challa Main Lad Jaana", "Challa Main Lad Jaana Uri Surgical Strike full video", [["challa"]]),
    ("Desh Mere", "Desh Mere Bhuj Arijit Singh Arko full song", [["desh mere"]]),
    ("Bharat Ki Beti", "Bharat Ki Beti Gunjan Saxena Kargil Girl Arijit Singh", [["bharat ki beti"]]),
    ("Kadam Kadam Badhaye Ja", "Kadam Kadam Badhaye Ja Azad Hind Fauj regimental song", [["kadam kadam"]]),
    ("Ae Mere Watan Ke Logon", "Ae Mere Watan Ke Logon Lata Mangeshkar", [["watan ke logon"]]),
    ("Mera Mulk Mera Desh", "Mera Mulk Mera Desh Diljale full song", [["mera mulk"]]),
    ("Suno Gaur Se Duniya Walon", "Suno Gaur Se Duniya Walon Dus full song", [["gaur se"]]),
    ("I Love My India", "I Love My India Pardes full song Tips", [["i love my india"]]),
    ("Des Rangila", "Des Rangila Fanaa Mahalaxmi Iyer YRF", [["des rangila"]]),
    ("Aisa Des Hai Mera", "Aisa Des Hai Mera Veer Zaara full song", [["aisa des hai mera"]]),
    ("Sarfaroshi Ki Tamanna", "Sarfaroshi Ki Tamanna The Legend of Bhagat Singh A R Rahman", [["sarfaroshi"]]),
    ("Mera Rang De Basanti Chola", "Mera Rang De Basanti Chola Shaheed Bhagat Singh song", [["basanti chola"]]),
    ("Ziddi Dil", "Ziddi Dil Mary Kom Vishal Dadlani full video", [["ziddi dil"]]),
    ("Zinda", "Zinda Bhaag Milkha Bhaag Siddharth Mahadevan full song", [["zinda"]]),
    ("Bhaag Milkha Bhaag", "Bhaag Milkha Bhaag title song rock version full video", [["bhaag milkha"]]),
    ("Jai Hind Ki Senaa", "Jai Hind Ki Senaa Shershaah full song Vikram Montrose", [["jai hind"]]),
    ("Sher Khul Gaye", "Sher Khul Gaye Fighter full video T-Series", [["sher khul gaye"]]),
    ("Vande Mataram (Fighter)", "Vande Mataram Fighter anthem Hrithik Roshan full video", [["vande mataram"]]),
    ("Aye Mere Pyare Watan", "Aye Mere Pyare Watan Kabuliwala Manna Dey", [["pyare watan"]]),
    ("Hum Honge Kamyab", "Hum Honge Kamyab Ek Din full song", [["kamyab"]]),
    ("Shankara Re Shankara", "Shankara Re Shankara Tanhaji full video song", [["shankara"]]),
    ("Bharat Humko Jaan Se Pyara Hai", "Bharat Humko Jaan Se Pyara Hai Roja Hariharan", [["jaan se pyara"]]),
    ("Teri Mitti (Female)", "Teri Mitti Female Version Kesari Parineeti Chopra", [["teri mitti"], ["female"]]),
    ("Main Aisa Kyun Hoon", "Main Aisa Kyon Hoon Lakshya Shankar Mahadevan", [["aisa kyon", "aisa kyun"]]),
    ("Lehra Do", "Lehra Do 83 Arijit Singh Pritam full video", [["lehra do"]]),
    ("Saare Jahan Se Accha", "Saare Jahan Se Accha Hindustan Hamara patriotic song", [["jahan se ach"]]),
    ("Nanha Munna Rahi Hoon", "Nanha Munna Rahi Hoon Son of India song", [["nanha munna"]]),
    ("Jhanda Ooncha Rahe Hamara", "Jhanda Ooncha Rahe Hamara patriotic song", [["jhanda ooncha"]]),
    ("Khalbali", "Khalbali Rang De Basanti A R Rahman full song", [["khalbali"]]),
    ("Roobaroo", "Roobaroo Rang De Basanti A R Rahman Naresh Iyer", [["roobaroo", "rubaroo"]]),
    ("Ghar Kab Aaoge", "Ghar Kab Aaoge Border 1997 Roopkumar Rathod full song", [["ghar kab aaoge"]]),
    ("Yeh Dil Maange More", "Yeh Dil Maange More LOC Kargil full song", [["maange more"]]),
    ("Hindustani", "Hindustani Dus 1997 Sonu Nigam patriotic song", [["hindustani"]]),
    ("Vande Mataram (ABCD 2)", "Vande Mataram ABCD 2 Daler Mehndi full song", [["vande mataram"]]),
    ("Mard Maratha", "Mard Maratha Panipat full video song Ajay-Atul", [["mard maratha"]]),
    ("Maay Bhavani", "Maay Bhavani Tanhaji full video song Shreya Ghoshal", [["maay bhavani", "mai bhavani"]]),
    ("Sanu Kehndi", "Sanu Kehndi Kesari full video song Akshay Kumar", [["sanu kehndi"]]),
    ("Jai Jawan Jai Kisan", "Jai Jawan Jai Kisan patriotic song Lal Bahadur Shastri", [["jai jawan"]]),
    ("Dil Diya Hai Jaan Bhi Denge", "Dil Diya Hai Jaan Bhi Denge Karma 1986 song", [["jaan bhi denge"]]),
    ("Kargil Ka Shershah", "Captain Vikram Batra Kargil tribute song Param Vir Chakra", [["shershah", "shershaah", "vikram batra"]]),
    ("Uri Theme", "Uri The Surgical Strike theme Shashwat Sachdev soundtrack", [["uri"]]),
    ("Bharat Ke Veer", "Bharat Ke Veer Indian Army tribute song", [["bharat ke veer"]]),
]


def norm(s):
    s = unicodedata.normalize("NFKD", s).lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def title_ok(title, must):
    t = norm(title)
    for group in must:
        if not any(norm(alt) in t for alt in group):
            return False
    return True


def main():
    results = []
    seen = set()
    for i, (name, query, must) in enumerate(SONGS, 1):
        print(f"[{i}/{len(SONGS)}] {name}", file=sys.stderr)
        try:
            cands = search_candidates(query, limit=10)
        except Exception as e:
            print(f"   search failed: {e}", file=sys.stderr)
            continue
        cands.sort(key=score, reverse=True)

        picked = None
        for c in cands:
            if c["id"] in seen:
                continue
            if not title_ok(c["title"], must):
                continue
            exists, embeddable, otitle, oauthor = verify(c["id"])
            if not exists or not embeddable:
                print(f"   skip {c['id']} exists={exists} embed={embeddable}", file=sys.stderr)
                time.sleep(0.25)
                continue
            if otitle and not title_ok(otitle, must):
                print(f"   title drift: {otitle[:60]}", file=sys.stderr)
                continue
            picked = {
                "id": c["id"],
                "song": name,
                "title": otitle or c["title"],
                "channel": oauthor or c["channel"],
                "duration": c["duration"],
            }
            break

        if picked:
            seen.add(picked["id"])
            results.append(picked)
            print(f"   OK  {picked['id']}  {picked['title'][:70]}", file=sys.stderr)
        else:
            print("   NONE", file=sys.stderr)
        time.sleep(0.35)

    json.dump(results, sys.stdout, ensure_ascii=False, indent=2)
    print(f"\nResolved {len(results)}/{len(SONGS)}", file=sys.stderr)


if __name__ == "__main__":
    main()
