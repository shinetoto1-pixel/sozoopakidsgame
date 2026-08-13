from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * 0.04)
    radius = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(139, 195, 74, 255))

    body = (111, 191, 92, 255)
    belly = (142, 217, 126, 255)
    r = size * 0.11

    # 몸통 마디 (곡선으로 배치)
    points = [
        (0.30, 0.72), (0.38, 0.62), (0.46, 0.55), (0.56, 0.52), (0.66, 0.5),
    ]
    for i, (px, py) in enumerate(points[:-1]):
        cx, cy = px * size, py * size
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=body)
        d.ellipse([cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7], fill=belly)

    # 머리
    hx, hy = points[-1][0] * size, points[-1][1] * size
    hr = r * 1.3
    d.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=body)
    # 더듬이
    d.line([(hx - hr * 0.3, hy - hr * 0.8), (hx - hr * 0.6, hy - hr * 1.5)], fill=(74, 154, 58, 255), width=int(size * 0.012))
    d.line([(hx + hr * 0.3, hy - hr * 0.8), (hx + hr * 0.6, hy - hr * 1.5)], fill=(74, 154, 58, 255), width=int(size * 0.012))
    d.ellipse([hx - hr * 0.6 - 4, hy - hr * 1.5 - 4, hx - hr * 0.6 + 4, hy - hr * 1.5 + 4], fill=belly)
    d.ellipse([hx + hr * 0.6 - 4, hy - hr * 1.5 - 4, hx + hr * 0.6 + 4, hy - hr * 1.5 + 4], fill=belly)
    # 눈
    eye_r = hr * 0.18
    for dx in (-0.3, 0.3):
        ex, ey = hx + hr * 0.25, hy + dx * hr
        d.ellipse([ex - eye_r, ey - eye_r, ex + eye_r, ey + eye_r], fill=(43, 43, 43, 255))
        d.ellipse([ex - eye_r * 0.4 - eye_r * 0.3, ey - eye_r * 0.4 - eye_r * 0.3, ex - eye_r * 0.4 + eye_r * 0.3, ey - eye_r * 0.4 + eye_r * 0.3], fill=(255, 255, 255, 230))

    img.save(path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("done")
