from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * 0.04)
    radius = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(58, 58, 58, 255))

    cx, cy = size * 0.5, size * 0.56
    body_w, body_h = size * 0.5, size * 0.26
    tank_color = (255, 217, 61, 255)

    # 캐터필러(바퀴)
    tr = body_h * 0.55
    d.rounded_rectangle([cx - body_w / 2 - tr * 0.4, cy - body_h / 2, cx - body_w / 2 + tr * 0.4, cy + body_h / 2],
                         radius=tr * 0.4, fill=(70, 70, 70, 255))
    d.rounded_rectangle([cx + body_w / 2 - tr * 0.4, cy - body_h / 2, cx + body_w / 2 + tr * 0.4, cy + body_h / 2],
                         radius=tr * 0.4, fill=(70, 70, 70, 255))

    # 몸통
    d.rounded_rectangle([cx - body_w / 2, cy - body_h / 2, cx + body_w / 2, cy + body_h / 2],
                         radius=body_h * 0.3, fill=tank_color)

    # 포탑
    turret_r = body_h * 0.55
    d.ellipse([cx - turret_r, cy - body_h / 2 - turret_r * 0.6, cx + turret_r, cy - body_h / 2 + turret_r * 1.2],
              fill=tank_color)

    # 포신
    barrel_w = size * 0.05
    d.rectangle([cx - barrel_w / 2, cy - body_h / 2 - turret_r * 1.6, cx + barrel_w / 2, cy - body_h / 2 - turret_r * 0.4],
                fill=(60, 45, 10, 255))

    # 하이라이트
    d.ellipse([cx - turret_r * 0.5, cy - body_h / 2 - turret_r * 0.3, cx - turret_r * 0.1, cy - body_h / 2 + turret_r * 0.1],
              fill=(255, 255, 255, 90))

    img.save(path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("done")
