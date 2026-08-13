from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * 0.04)
    radius = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(255, 159, 91, 255))

    cx, cy = size * 0.5, size * 0.58
    r = size * 0.24
    body = (255, 174, 209, 255)
    ear_in = (255, 111, 156, 255)

    # 귀
    for dx in (-0.5, 0.5):
        ex = cx + dx * r
        ey = cy - r * 1.5
        d.ellipse([ex - r * 0.21, ey - r * 1.15, ex + r * 0.21, ey + r * 1.15], fill=body)
        d.ellipse([ex - r * 0.1, ey - r * 0.75, ex + r * 0.1, ey + r * 0.75], fill=ear_in)

    # 얼굴
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=body)
    hl_r = r * 0.32
    d.ellipse([cx - r * 0.55 - hl_r, cy - r * 0.5 - hl_r, cx - r * 0.55 + hl_r, cy - r * 0.5 + hl_r],
              fill=(255, 255, 255, 110))

    # 눈, 코
    eye_r = r * 0.09
    d.ellipse([cx - r * 0.32 - eye_r, cy - eye_r, cx - r * 0.32 + eye_r, cy + eye_r], fill=(43, 43, 43, 255))
    d.ellipse([cx + r * 0.32 - eye_r, cy - eye_r, cx + r * 0.32 + eye_r, cy + eye_r], fill=(43, 43, 43, 255))
    nr = r * 0.12
    d.polygon([(cx - nr, cy + r * 0.22), (cx + nr, cy + r * 0.22), (cx, cy + r * 0.36)], fill=(255, 143, 163, 255))

    img.save(path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("done")
