#!/usr/bin/env python3
"""
VEGEX — сборка статического лендинга.
Запуск:  python build.py
"""

import base64
import io
import mimetypes
import re
import shutil
from pathlib import Path

import yaml
from PIL import Image
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"
DIST = ROOT / "dist"

LANGS = ["ru"]

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def translit(name: str) -> str:
    out = []
    for ch in name.lower():
        out.append(TRANSLIT.get(ch, ch))
    slug = "".join(out)
    slug = re.sub(r"[^a-z0-9._-]+", "-", slug).strip("-").rstrip(".")
    return slug


def data_uri(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    mime = mime or "application/octet-stream"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


IMG_MAX_DIMENSION = 1800
IMG_JPEG_QUALITY = 78


def compressed_jpeg_bytes(path: Path) -> bytes:
    with Image.open(path) as im:
        im = im.convert("RGB")
        w, h = im.size
        longest = max(w, h)
        if longest > IMG_MAX_DIMENSION:
            scale = IMG_MAX_DIMENSION / longest
            im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=IMG_JPEG_QUALITY, optimize=True)
        return buf.getvalue()


CLOUDFLARE_ASSET_LIMIT_MB = 25


def copy_hero_video(out_dir: Path) -> str | None:
    """
    Если в static/video/ есть hero.mp4 (или .webm) — копируем как отдельный
    файл рядом с index.html (НЕ base64). Видео обычно весит десятки МБ —
    в отличие от фото/шрифтов, инлайнить его в HTML нельзя: страница
    раздувается до многих десятков МБ и не открывается нормально.
    На self-contained-требование это не влияет для продакшена (Cloudflare
    Pages просто отдаёт видео отдельным запросом с кэшированием) — оно
    касалось только локальной проверки через file://. Для локального
    просмотра с видео используйте `python -m http.server -d dist`.

    Cloudflare Workers/Pages не примет ни один статический файл тяжелее
    25 МБ (деплой упадёт с "Asset too large") — проверяем это здесь, чтобы
    поймать проблему на сборке, а не только при пуше на прод.
    """
    video_dir = STATIC / "video"
    if not video_dir.exists():
        return None
    for ext in ("mp4", "webm"):
        candidates = sorted(video_dir.glob(f"hero.{ext}"))
        if candidates:
            src = candidates[0]
            size_mb = src.stat().st_size / 1024 / 1024
            if size_mb > CLOUDFLARE_ASSET_LIMIT_MB:
                print(
                    f"  ⚠️  ВНИМАНИЕ: {src.name} весит {size_mb:.1f} МБ — "
                    f"больше лимита Cloudflare в {CLOUDFLARE_ASSET_LIMIT_MB} МБ. "
                    f"Деплой на Cloudflare Pages упадёт. Сожмите видео перед пушем, "
                    f"например: ffmpeg -i hero.mp4 -vf scale=1600:-2 -c:v libx264 "
                    f"-crf 28 -an -movflags +faststart hero-small.mp4"
                )
            assets_dir = out_dir / "assets"
            assets_dir.mkdir(parents=True, exist_ok=True)
            dest = assets_dir / f"hero.{ext}"
            shutil.copy2(src, dest)
            return f"assets/hero.{ext}"
    return None


def copy_images(out_dir: Path) -> dict:
    """
    Сжимает фото (Pillow) и копирует как отдельные JPEG-файлы в
    dist/<lang>/assets/images/ — по тому же принципу, что и hero-видео
    (copy_hero_video): раньше фото инлайнились в base64 прямо в HTML,
    из-за чего страница весила МБ 3-4+ одним файлом (тот же баг, что был
    у видео до 62 МБ). Отдельные файлы браузер кэширует по отдельности
    и не грузит все фото разом до первой отрисовки.
    """
    index = {}
    img_dir = STATIC / "images"
    if not img_dir.exists():
        return index
    assets_dir = out_dir / "assets" / "images"
    assets_dir.mkdir(parents=True, exist_ok=True)
    for f in sorted(img_dir.iterdir()):
        if not f.is_file() or f.name.startswith("."):
            continue
        key = translit(f.stem)
        if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
            data = compressed_jpeg_bytes(f)
            dest = assets_dir / f"{key}.jpg"
        else:
            data = f.read_bytes()
            dest = assets_dir / f"{key}{f.suffix.lower()}"
        dest.write_bytes(data)
        index[key] = f"assets/images/{dest.name}"
    return index


UNICODE_RANGE = {
    "cyrillic": "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
    "latin": (
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
        "U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,"
        "U+2212,U+2215,U+FEFF,U+FFFD"
    ),
}


def build_fonts_css() -> str:
    fonts_dir = STATIC / "fonts"
    if not fonts_dir.exists():
        return ""
    blocks = []
    for f in sorted(fonts_dir.glob("*.woff2")):
        m = re.search(r"(cyrillic|latin)-(\d{3})", f.stem)
        if not m:
            continue
        subset, weight = m.group(1), m.group(2)
        urange = UNICODE_RANGE.get(subset)
        rng = f"unicode-range:{urange};" if urange else ""
        blocks.append(
            "@font-face{font-family:'Montserrat';font-style:normal;"
            f"font-weight:{weight};font-display:swap;"
            f"src:url({data_uri(f)}) format('woff2');{rng}}}"
        )
    return "\n".join(blocks)


def load_content(lang: str) -> dict:
    path = CONTENT / f"{lang}.yaml"
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def make_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )


def render_lang(env, lang, css, js, fonts_css, fonts_present):
    ctx = load_content(lang)
    out_dir = DIST / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    hero_video = copy_hero_video(out_dir)
    images = copy_images(out_dir)

    def img(key: str):
        if not key:
            return None
        return images.get(translit(key))

    env.globals["img"] = img
    env.globals["has_img"] = lambda key: translit(key or "") in images

    ctx.update({
        "lang": lang,
        "langs": LANGS,
        "css_inline": css,
        "js_inline": js,
        "fonts_css_inline": fonts_css,
        "fonts_inlined": fonts_present,
        "hero_video": hero_video,
    })
    html = env.get_template("base.html").render(**ctx)
    (out_dir / "index.html").write_text(html, encoding="utf-8")
    return len(html), hero_video is not None, len(images)


def main():
    if DIST.exists():
        shutil.rmtree(DIST)

    css = (STATIC / "css" / "main.css").read_text(encoding="utf-8")
    js = (STATIC / "js" / "main.js").read_text(encoding="utf-8")
    fonts_css = build_fonts_css()
    fonts_present = bool(fonts_css)

    env = make_env()

    print(f"Шрифты инлайн: {'да' if fonts_present else 'нет (Google Fonts fallback)'}")
    for lang in LANGS:
        size, has_video, n_images = render_lang(env, lang, css, js, fonts_css, fonts_present)
        video_note = " + видео отдельным файлом" if has_video else ""
        print(f"  dist/{lang}/index.html — {size // 1024} КБ, фото: {n_images} отдельными файлами{video_note}")

    primary = LANGS[0]
    (DIST / "index.html").write_text(
        "<!DOCTYPE html><html lang=\"" + primary + "\"><head><meta charset=\"UTF-8\">"
        f"<meta http-equiv=\"refresh\" content=\"0; url=/{primary}/\">"
        f"<link rel=\"canonical\" href=\"/{primary}/\">"
        f"<title>VEGEX</title></head><body><a href=\"/{primary}/\">VEGEX</a></body></html>",
        encoding="utf-8",
    )
    print(f"  dist/index.html — редирект на /{primary}/")
    print("Готово.")


if __name__ == "__main__":
    main()