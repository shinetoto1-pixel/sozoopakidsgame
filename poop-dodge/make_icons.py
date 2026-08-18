from PIL import Image, ImageDraw
import math

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * 0.04)
    radius = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(107, 79, 58, 255))

    # 똥 (아이콘 상단, 살짝 작게)
    cx, cy = size * 0.5, size * 0.34
    poop_color = (121, 85, 61, 255)
    for i, (ry, rr) in enumerate([(0.14, 0.20), (0.06, 0.155), (0, 0.10)]):
        yy = cy + ry * size - i * size * 0.01
        d.ellipse([cx - rr * size, yy - rr * size, cx + rr * size, yy + rr * size], fill=poop_color)
    eye_r = size * 0.018
    d.ellipse([cx - size * 0.05 - eye_r, cy - size * 0.02 - eye_r, cx - size * 0.05 + eye_r, cy - size * 0.02 + eye_r], fill=(50, 35, 25, 255))
    d.ellipse([cx + size * 0.05 - eye_r, cy - size * 0.02 - eye_r, cx + size * 0.05 + eye_r, cy - size * 0.02 + eye_r], fill=(50, 35, 25, 255))

    # 별 (하단, 좋은 아이템 상징)
    scx, scy = size * 0.5, size * 0.72
    sr_out, sr_in = size * 0.16, size * 0.065
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        r = sr_out if i % 2 == 0 else sr_in
        pts.append((scx + math.cos(ang) * r, scy + math.sin(ang) * r))
    d.polygon(pts, fill=(255, 214, 92, 255))

    img.save(path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("done")
