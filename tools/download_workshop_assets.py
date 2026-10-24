#!/usr/bin/env python3
"""Bundle pinned Poly Haven CC0 workshop assets as self-contained 1K GLBs."""
import hashlib
import json
from pathlib import Path
import struct
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen

ASSETS = (
    "WoodenTable_03", "painted_wooden_table", "metal_office_desk",
    "wooden_stool_01", "metal_toolbox", "adjustable_wrench",
    "vintage_oil_lamp", "portable_welding_cart", "worn_metal_rack",
)
DEST = Path(__file__).resolve().parents[1] / "frontend/public/assets/workshop"
HEADERS = {"User-Agent": "GuaTec-Asset-Research/1.0"}


def read(url):
    with urlopen(Request(url, headers=HEADERS), timeout=60) as response:
        return response.read()


def build(asset):
    manifest = json.loads(read(f"https://api.polyhaven.com/files/{asset}"))
    spec = manifest["gltf"]["1k"]["gltf"]
    doc = json.loads(read(spec["url"]))
    dependencies = spec["include"]
    binary = bytearray()

    def append(data):
        binary.extend(b"\0" * (-len(binary) % 4))
        offset = len(binary)
        binary.extend(data)
        return offset

    def dependency(uri):
        item = dependencies[uri]
        data = read(item["url"])
        if hashlib.md5(data).hexdigest() != item["md5"]:
            raise ValueError(f"Checksum mismatch: {asset}/{uri}")
        return data

    offsets = [append(dependency(buffer["uri"])) for buffer in doc["buffers"]]
    for view in doc.get("bufferViews", []):
        view["byteOffset"] = view.get("byteOffset", 0) + offsets[view["buffer"]]
        view["buffer"] = 0
    for image in doc.get("images", []):
        uri = image.pop("uri")
        data = dependency(uri)
        offset = append(data)
        image["bufferView"] = len(doc["bufferViews"])
        image["mimeType"] = "image/jpeg" if uri.endswith(".jpg") else "image/png"
        doc["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(data)})
    doc["buffers"] = [{"byteLength": len(binary)}]
    doc.setdefault("asset", {})["copyright"] = f"Poly Haven / {asset} / CC0 1.0 — https://polyhaven.com/a/{asset}"
    encoded = json.dumps(doc, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    binary.extend(b"\0" * (-len(binary) % 4))
    glb = struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(binary))
    glb += struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
    glb += struct.pack("<II", len(binary), 0x004E4942) + binary
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / f"{asset}.glb").write_bytes(glb)
    print(f"{asset}: {len(glb):,} bytes")
    return {"id": asset, "source": f"https://polyhaven.com/a/{asset}", "license": "CC0-1.0", "sha256": hashlib.sha256(glb).hexdigest(), "bytes": len(glb)}


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=4) as pool:
        sources = list(pool.map(build, ASSETS))
    (DEST / "sources.json").write_text(json.dumps(sources, indent=2) + "\n")
