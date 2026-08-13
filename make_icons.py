from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * 0.04)
    radius = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(123, 92, 255, 255))

    # 게임패드 모양
    body_w, body_h = size * 0.62, size * 0.34
    bx, by = (size - body_w) / 2, size * 0.36
    d.rounded_rectangle([bx, by, bx + body_w, by + body_h], radius=body_h * 0.5, fill=(255, 255, 255, 235))

    # 왼쪽 손잡이
    grip_r = body_h * 0.42
    d.ellipse([bx - grip_r * 0.5, by + body_h * 0.35, bx + grip_r * 1.1, by + body_h * 0.35 + grip_r * 1.3],
              fill=(255, 255, 255, 235))
    d.ellipse([bx + body_w - grip_r * 1.1, by + body_h * 0.35, bx + body_w + grip_r * 0.5, by + body_h * 0.35 + grip_r * 1.3],
              fill=(255, 255, 255, 235))

    # 십자 방향키 (왼쪽)
    cx, cy = bx + body_w * 0.24, by + body_h * 0.5
    bar_l, bar_w = body_h * 0.5, body_h * 0.16
    d.rounded_rectangle([cx - bar_l / 2, cy - bar_w / 2, cx + bar_l / 2, cy + bar_w / 2], radius=bar_w * 0.4, fill=(123, 92, 255, 255))
    d.rounded_rectangle([cx - bar_w / 2, cy - bar_l / 2, cx + bar_w / 2, cy + bar_l / 2], radius=bar_w * 0.4, fill=(123, 92, 255, 255))

    # 버튼 (오른쪽)
    r = body_h * 0.13
    ox, oy = bx + body_w * 0.76, by + body_h * 0.5
    d.ellipse([ox - r * 1.7, oy - r, ox - r * 1.7 + r * 2, oy - r + r * 2], fill=(255, 205, 86, 255))
    d.ellipse([ox + r * 0.3, oy - r, ox + r * 0.3 + r * 2, oy - r + r * 2], fill=(255, 107, 107, 255))

    img.save(path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("done")
