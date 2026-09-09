"""สร้าง QR ทั้งชุดจาก URL เดียว: ไฟล์ QR ล้วน, การ์ด PNG และ QR ที่ฝังใน share.html

แก้ค่า URL ด้านล่างแล้วรัน `python tools_qr.py` เมื่อไหร่ที่ที่อยู่เว็บเปลี่ยน
"""
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import qrcode
from qrcode.constants import ERROR_CORRECT_M

URL = "https://magical-heart.netlify.app/"
CARD_OUT = "assets/qr-card.png"
PLAIN_OUT = "assets/qr.png"
SHARE_PAGE = "share.html"
W, H = 1200, 1500
random.seed(11)

base = Image.new('RGBA', (W, H), (1, 3, 12, 255))


def glow_ellipse(cx, cy, rx, ry, color, alpha, blur):
    """ก้อนแสงกลมนุ่ม ๆ วาดเป็นวงรีแล้วเบลอ"""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(
        [cx - rx, cy - ry, cx + rx, cy + ry], fill=color + (int(255 * alpha),))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


# ---------- ฉากหลัง ----------
glow_ellipse(600, 430, 620, 460, (37, 99, 235), 0.40, 190)
glow_ellipse(150, 1180, 460, 400, (14, 116, 144), 0.34, 170)
glow_ellipse(1060, 250, 430, 380, (79, 70, 229), 0.32, 170)
glow_ellipse(600, 1520, 780, 380, (12, 28, 66), 0.75, 200)

# ลูกแสงลอย
for _ in range(30):
    r = random.choice([5, 8, 12, 18, 26, 38, 54])
    x, y = random.randint(-40, W + 40), random.randint(-40, H + 40)
    glow_ellipse(x, y, r, r, (191, 219, 254),
                 random.uniform(0.18, 0.5), r * (0.5 if r < 20 else 0.9))

# ---------- การ์ด ----------
CARD = (110, 170, W - 110, H - 170)
RADIUS = 64

shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(CARD, RADIUS, fill=(96, 165, 250, 105))
base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(75)))

card = Image.new('RGBA', (W, H), (0, 0, 0, 0))
cd = ImageDraw.Draw(card)
cd.rounded_rectangle(CARD, RADIUS, fill=(10, 20, 46, 210))
cd.rounded_rectangle(CARD, RADIUS, outline=(191, 219, 254, 125), width=2)
base.alpha_composite(card)

# ---------- QR ----------
q = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=20, border=0)
q.add_data(URL)
q.make(fit=True)
qr = q.make_image(fill_color="#071022", back_color="white").convert('RGB')

QS, QY, PAD = 620, 530, 44
qr = qr.resize((QS, QS), Image.NEAREST)
plate = ((W - QS) // 2 - PAD, QY - PAD, (W + QS) // 2 + PAD, QY + QS + PAD)

pg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(pg).rounded_rectangle(plate, 52, fill=(147, 197, 253, 125))
base.alpha_composite(pg.filter(ImageFilter.GaussianBlur(40)))

pl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(pl).rounded_rectangle(plate, 52, fill=(252, 253, 255, 255))
base.alpha_composite(pl)
base.paste(qr, ((W - QS) // 2, QY))

# มุมกรอบสี่มุม
corners = Image.new('RGBA', (W, H), (0, 0, 0, 0))
cdr = ImageDraw.Draw(corners)
L, T, R, B = plate
ARM, OFF, WID = 48, 20, 3
for x, y, dx, dy in [(L - OFF, T - OFF, 1, 1), (R + OFF, T - OFF, -1, 1),
                     (L - OFF, B + OFF, 1, -1), (R + OFF, B + OFF, -1, -1)]:
    cdr.line([(x, y), (x + dx * ARM, y)], fill=(191, 219, 254, 215), width=WID)
    cdr.line([(x, y), (x, y + dy * ARM)], fill=(191, 219, 254, 215), width=WID)
base.alpha_composite(corners.filter(ImageFilter.GaussianBlur(4)))
base.alpha_composite(corners)


# ---------- ตัวหนังสือ ----------
def with_glow(draw_fn, blur=16):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    base.alpha_composite(layer)


font_title = ImageFont.truetype("C:/Windows/Fonts/georgia.ttf", 58)
TITLE, TRACK, WORD_GAP, TY = "SCANME", 34, 86, 355


def draw_title(d):
    widths = [d.textlength(ch, font=font_title) for ch in TITLE]
    extra = [TRACK] * len(TITLE)
    extra[3] = WORD_GAP                      # ช่องไฟระหว่าง SCAN กับ ME
    total = sum(widths) + sum(extra[:-1])
    x = (W - total) / 2
    for i, (ch, w) in enumerate(zip(TITLE, widths)):
        d.text((x, TY), ch, font=font_title, fill=(242, 248, 255, 255), anchor="lm")
        x += w + extra[i]
    gap, line = total / 2 + 56, 96
    d.line([(W / 2 - gap - line, TY), (W / 2 - gap, TY)], fill=(191, 219, 254, 185), width=2)
    d.line([(W / 2 + gap, TY), (W / 2 + gap + line, TY)], fill=(191, 219, 254, 185), width=2)


with_glow(draw_title)

font_heart = ImageFont.truetype("C:/Windows/Fonts/seguisym.ttf", 62)
with_glow(lambda d: d.text((W / 2, 1258), "\u2661", font=font_heart,
                           fill=(207, 227, 255, 220), anchor="mm"), blur=12)

base.convert('RGB').save(CARD_OUT, quality=95)
print("saved", CARD_OUT, base.size)


# ---------- QR ล้วนไว้ใช้ที่อื่น ----------
plain = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=32, border=3)
plain.add_data(URL)
plain.make(fit=True)
plain.make_image(fill_color="#0b1220", back_color="white").save(PLAIN_OUT)
print("saved", PLAIN_OUT)


# ---------- อัปเดต QR + ลิงก์ในหน้า share ----------
import re
from qrcode.image.svg import SvgPathImage

svg = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=10, border=2)
svg.add_data(URL)
svg.make(fit=True)
raw = svg.make_image(image_factory=SvgPathImage).to_string().decode()
view_box = re.search(r'viewBox="([^"]+)"', raw).group(1)
path = re.search(r'<path[^>]*\sd="([^"]+)"', raw).group(1)

page = open(SHARE_PAGE, encoding="utf-8").read()
page = re.sub(r'(<svg viewBox=")[^"]+(")', lambda m: m.group(1) + view_box + m.group(2), page)
page = re.sub(r'(<path d=")[^"]+(")', lambda m: m.group(1) + path + m.group(2), page)
page = re.sub(r'(<a class="card" href=")[^"]+(")', lambda m: m.group(1) + URL + m.group(2), page)
open(SHARE_PAGE, "w", encoding="utf-8").write(page)
print("updated", SHARE_PAGE)
