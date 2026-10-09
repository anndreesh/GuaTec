#!/usr/bin/env python3
"""Fetch the pinned 1K CC0 Poly Haven assets used by Mission 01."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1] / "frontend/public/assets/polyhaven"
MODELS = ("wooden_crate_02", "wooden_bucket_02", "trowel_01")
TEXTURES = ("farm_soil", "muddy_tracks", "grass_ground")
HDRI = "suburban_field_01"
API = "https://api.polyhaven.com"


def fetch_json(url: str):
    request = Request(url, headers={"User-Agent": "Mission01EducationalGame/1.0"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def download(url: str, destination: Path):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size:
        return
    request = Request(url, headers={"User-Agent": "Mission01EducationalGame/1.0"})
    with urlopen(request, timeout=60) as response, destination.open("wb") as output:
        output.write(response.read())
    print(f"Downloaded {destination.relative_to(ROOT)}")


def collect_files(value, prefix=""):
    if not isinstance(value, dict):
        return
    for key, item in value.items():
        path = f"{prefix}/{key}" if prefix else key
        if isinstance(item, dict) and item.get("url"):
            yield path, item["url"]
        else:
            yield from collect_files(item, path)


def main():
    for asset in MODELS:
        manifest = fetch_json(f"{API}/files/{asset}")
        model = manifest["gltf"]["1k"]["gltf"]
        folder = ROOT / "models" / asset
        download(model["url"], folder / Path(model["url"]).name)
        for relative, url in collect_files(model.get("include", {})):
            download(url, folder / relative)

    for asset in TEXTURES:
        manifest = fetch_json(f"{API}/files/{asset}")
        includes = manifest["gltf"]["1k"]["gltf"].get("include", {})
        folder = ROOT / "textures" / asset
        for relative, url in collect_files(includes):
            if relative.endswith(".jpg"):
                download(url, folder / relative)

    hdri = fetch_json(f"{API}/files/{HDRI}")["hdri"]["1k"]["hdr"]
    download(hdri["url"], ROOT / "hdri" / f"{HDRI}_1k.hdr")


if __name__ == "__main__":
    main()
