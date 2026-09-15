"""Build numbered contact sheets of the downloaded backgrounds for review.

Usage: python3 tools/make_contact_sheet.py [per_sheet]
Writes data/sheet_N.jpg
"""

import json
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLS = 3
CELL_W, CELL_H = 420, 236
PAD = 8
LABEL_H = 20


def main():
    per = int(sys.argv[1]) if len(sys.argv) > 1 else 12

    src = os.path.join(ROOT, "assets", "data", "backgrounds.js")
    text = open(src, encoding="utf-8").read()
    items = json.loads(text[text.index("["):text.rindex(";")])

    for sheet_no in range((len(items) + per - 1) // per):
        chunk = items[sheet_no * per:(sheet_no + 1) * per]
        rows = (len(chunk) + COLS - 1) // COLS
        W = COLS * CELL_W + (COLS + 1) * PAD
        H = rows * (CELL_H + LABEL_H) + (rows + 1) * PAD
        sheet = Image.new("RGB", (W, H), (17, 17, 17))
        draw = ImageDraw.Draw(sheet)

        for i, item in enumerate(chunk):
            gi = sheet_no * per + i
            r, c = divmod(i, COLS)
            x = PAD + c * (CELL_W + PAD)
            y = PAD + r * (CELL_H + LABEL_H + PAD)
            path = os.path.join(ROOT, item["src"])
            try:
                im = Image.open(path).convert("RGB")
                # cover-crop to the cell aspect
                tr, ir = CELL_W / CELL_H, im.width / im.height
                if ir > tr:
                    nw = int(im.height * tr)
                    im = im.crop(((im.width - nw) // 2, 0, (im.width + nw) // 2, im.height))
                else:
                    nh = int(im.width / tr)
                    im = im.crop((0, (im.height - nh) // 2, im.width, (im.height + nh) // 2))
                im = im.resize((CELL_W, CELL_H), Image.LANCZOS)
                sheet.paste(im, (x, y))
            except Exception as e:
                draw.rectangle([x, y, x + CELL_W, y + CELL_H], fill=(60, 20, 20))
                draw.text((x + 8, y + 8), f"ERR {e}"[:48], fill=(255, 200, 200))

            name = os.path.basename(item["src"])[:44]
            draw.text((x + 3, y + CELL_H + 4), f"[{gi}] {name}", fill=(255, 178, 87))

        out = os.path.join(ROOT, "data", f"sheet_{sheet_no}.jpg")
        sheet.save(out, quality=82)
        print(out)


if __name__ == "__main__":
    main()
