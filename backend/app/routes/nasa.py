from __future__ import annotations

from datetime import datetime
from html import unescape
import re
from xml.etree import ElementTree

from flask import Blueprint, current_app, jsonify
import requests

nasa_bp = Blueprint("nasa", __name__)


@nasa_bp.get("/mission-briefing")
def mission_briefing():
    """Return NASA imagery and context used by the mission hub.

    The API key remains server-side. A failed upstream request is reported to
    the client only when no NASA content is available from any source.
    """
    api_key = current_app.config["NASA_API_KEY"]
    apod = {}
    try:
        apod_response = requests.get(
            "https://api.nasa.gov/planetary/apod",
            params={"api_key": api_key, "thumbs": "true"},
            timeout=8,
        )
        apod_response.raise_for_status()
        apod = apod_response.json()
    except requests.RequestException as exc:
        current_app.logger.warning(
            "NASA APOD request failed (status %s)",
            exc.response.status_code if exc.response is not None else "unavailable",
        )

    mars_items = []
    try:
        mars_response = requests.get(
            "https://images-api.nasa.gov/search",
            params={"q": "Mars rover", "media_type": "image", "page_size": 20},
            timeout=8,
        )
        mars_response.raise_for_status()
        mars_items = mars_response.json().get("collection", {}).get("items", [])
        mars_items.sort(
            key=lambda item: (item.get("data") or [{}])[0].get("date_created") or "",
            reverse=True,
        )
    except requests.RequestException as exc:
        current_app.logger.warning(
            "NASA image search failed (status %s)",
            exc.response.status_code if exc.response is not None else "unavailable",
        )

    news_items = []
    try:
        news_response = requests.get(
            "https://www.nasa.gov/news-release/feed/",
            timeout=8,
            headers={"Accept": "application/rss+xml"},
        )
        news_response.raise_for_status()
        news_items = _parse_news_feed(news_response.text)
    except (requests.RequestException, ElementTree.ParseError) as exc:
        current_app.logger.warning("NASA news feed unavailable (%s)", type(exc).__name__)

    apod_image = apod.get("hdurl") or apod.get("url") or apod.get("thumbnail_url")
    apod_story = []
    if apod.get("title") or apod.get("explanation") or apod_image:
        apod_story.append(
            {
                "kind": "APOD",
                "title": apod.get("title"),
                "summary": apod.get("explanation"),
                "date": apod.get("date"),
                "imageUrl": apod_image,
                "images": [apod_image] if apod_image else [],
                "sourceUrl": apod.get("url"),
            }
        )
    stories = [
        *news_items[:5],
        *apod_story,
        *[
            {
                "kind": "INVESTIGACIÓN MARCIANA",
                "title": (photo.get("data") or [{}])[0].get("title"),
                "summary": (photo.get("data") or [{}])[0].get(
                    "description", "Registro visual del archivo NASA sobre la superficie de Marte."
                ),
                "date": (photo.get("data") or [{}])[0].get("date_created"),
                "imageUrl": (photo.get("links") or [{}])[0].get("href"),
                "images": [
                    link.get("href")
                    for link in (photo.get("links") or [])
                    if link.get("href")
                ][:4],
                "sourceUrl": f"https://images.nasa.gov/details-{(photo.get('data') or [{}])[0].get('nasa_id', '')}",
            }
            for photo in mars_items[:5]
            if (photo.get("links") or [{}])[0].get("href")
        ],
    ]
    if not stories:
        return jsonify({"error": "nasa_unavailable"}), 502

    return jsonify(
        {
            "stories": stories,
            "apod": {
                "title": apod.get("title"),
                "explanation": apod.get("explanation"),
                "date": apod.get("date"),
                "mediaType": apod.get("media_type"),
                "url": apod.get("url"),
                "imageUrl": apod.get("hdurl") or apod.get("url") or apod.get("thumbnail_url"),
                "copyright": apod.get("copyright"),
            },
            "marsPhotos": [
                {
                    "id": index,
                    "imgSrc": (photo.get("links") or [{}])[0].get("href", ""),
                    "earthDate": (photo.get("data") or [{}])[0].get("date_created"),
                    "camera": None,
                    "rover": ((photo.get("data") or [{}])[0].get("title") or "Mars rover"),
                }
                for index, photo in enumerate(mars_items[:6])
                if (photo.get("links") or [{}])[0].get("href")
            ],
            "source": "NASA Open APIs",
        }
    )


_CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}"


def _parse_news_feed(xml_text: str) -> list[dict]:
    root = ElementTree.fromstring(xml_text)
    stories = []
    for item in root.findall("./channel/item"):
        title = _xml_text(item.find("title"))
        link = _xml_text(item.find("link"))
        published = _xml_text(item.find("pubDate"))
        description = _strip_html(_xml_text(item.find("description")))
        content_html = _xml_text(item.find(f"{_CONTENT_NS}encoded"))
        images = _extract_images_from_html(content_html)
        if not title or not link:
            continue
        stories.append(
            {
                "kind": "NOTICIA NASA",
                "title": title,
                "summary": description or "Última actualización publicada por NASA.",
                "date": published,
                "imageUrl": images[0] if images else None,
                "images": images,
                "sourceUrl": link,
            }
        )
    stories.sort(key=lambda story: _news_date(story["date"]), reverse=True)
    return stories


def _extract_images_from_html(html: str, limit: int = 4) -> list[str]:
    """Pull unique, full-resolution image URLs out of a NASA article's HTML body."""
    seen: set[str] = set()
    images: list[str] = []
    for match in re.finditer(r'<img[^>]+src="([^"?]+)[^"]*"', html):
        src = match.group(1)
        if not src.startswith("http") or src in seen:
            continue
        seen.add(src)
        images.append(src)
        if len(images) >= limit:
            break
    return images


def _xml_text(element: ElementTree.Element | None) -> str:
    return (element.text or "").strip() if element is not None else ""


def _strip_html(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def _news_date(value: str) -> datetime:
    try:
        return datetime.strptime(value, "%a, %d %b %Y %H:%M:%S %z")
    except ValueError:
        return datetime.min
