from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * 0.04)
    radius = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(139, 111, 214, 255))

    # 뒤집힌 카드 두 장 (겹쳐서)
    cw, ch = size * 0.32, size * 0.42
    r = size * 0.06

    x1, y1 = size * 0.24, size * 0.30
    d.rounded_rectangle([x1, y1, x1 + cw, y1 + ch], radius=r, fill=(255, 255, 255, 235))
    scx, scy = x1 + cw / 2, y1 + ch / 2
    sr = cw * 0.22
    for i in range(5):
        import math
        a = -math.pi / 2 + i * (2 * math.pi / 5)
        d.ellipse([scx + math.cos(a) * sr - 5, scy + math.sin(a) * sr - 5,
                   scx + math.cos(a) * sr + 5, scy + math.sin(a) * sr + 5], fill=(139, 111, 214, 255))

    x2, y2 = size * 0.46, size * 0.30
    d.rounded_rectangle([x2, y2, x2 + cw, y2 + ch], radius=r, fill=(255, 224, 102, 255))
    # 하트 모양 (간단한 원 두 개 + 삼각형)
    hcx, hcy = x2 + cw / 2, y2 + ch / 2
    hr = cw * 0.18
    d.ellipse([hcx - hr * 1.6, hcy - hr * 0.6, hcx - hr * 0.2, hcy + hr], fill=(255, 107, 156, 255))
    d.ellipse([hcx + hr * 0.2, hcy - hr * 0.6, hcx + hr * 1.6, hcy + hr], fill=(255, 107, 156, 255))
    d.polygon([(hcx - hr * 1.4, hcy + hr * 0.3), (hcx + hr * 1.4, hcy + hr * 0.3), (hcx, hcy + hr * 2.1)],
              fill=(255, 107, 156, 255))

    img.save(path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("done")
