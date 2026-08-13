from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background rounded square, cheerful sky blue
    pad = int(size * 0.04)
    radius = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(74, 144, 226, 255))

    colors = [
        (255, 99, 132, 255),   # red/pink
        (255, 205, 86, 255),   # yellow
        (75, 192, 192, 255),   # teal
        (153, 102, 255, 255),  # purple
    ]
    positions_r = [
        (0.34, 0.36, 0.17),
        (0.62, 0.30, 0.13),
        (0.66, 0.62, 0.19),
        (0.32, 0.66, 0.14),
    ]
    for color, (cx, cy, r) in zip(colors, positions_r):
        cx, cy, r = cx * size, cy * size, r * size
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
        hl_r = r * 0.35
        hlx, hly = cx - r * 0.35, cy - r * 0.35
        d.ellipse([hlx - hl_r, hly - hl_r, hlx + hl_r, hly + hl_r], fill=(255, 255, 255, 140))

    img.save(path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("done")
