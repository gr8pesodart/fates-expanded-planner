"""Decoders for the FE Fates asset containers used by tools/assets.

Everything here is written from the public file-format descriptions:

  - LZ13: reused from the sibling fe-fates workspace's ``fe_tools`` (same codec
    the data extractors use).
  - BinArchive: the little-endian archive used for GameData, FaceData and the
    portrait ``.arc`` files. Header: u32 size, u32 data_size, u32 pointer_count,
    u32 label_count at +0..+0x0F, data at +0x20, then a pointer table, a label
    table (address, text offset) and the text section (Shift-JIS, 4-aligned).
    Pointer values above ``data_size`` are strings at ``value + 0x20``.
  - BCH (H3D binary): header at +0, content table at ``contents_address``;
    texture entries conventionally named "item"/"skill"/"belong" in FE Fates.
    Layout verified against mila (thane98, GPL-3.0) as a format reference and
    against the raw dumps (docs/ASSETS.md).
  - CTPK: CTR texture package (header + texture info table + pixel data).
    - Pixel formats 0..13 of the PICA200: RGBA8/RGB8/RGB5551/RGB565/RGBA4/LA8/
    HILO8/L8/A8/LA4/L4/A4, ETC1 and ETC1A4. Color formats are stored in 8x8
    tiles with the PICA200 tile order; ETC1 blocks are little-endian with
    column-major pixel indices inside each 4x4 block (GBATEK).

Dependencies: Pillow only (WebP/PNG output). The ETC1/ETC1A4 decoder is
written here from the GBATEK format description, cross-checked against
3DS-Texture-Forge (MIT) — see docs/ASSETS.md.
"""

from __future__ import annotations

import struct


class AssetError(Exception):
    pass


# ------------------------------- LZ13 ---------------------------------------


def lz13_blob_length(data: bytes, position: int) -> int | None:
    """Total byte length of an LZ13 blob at ``position`` (None if not one)."""
    if position + 4 > len(data) or data[position] != 0x13:
        return None
    return int.from_bytes(data[position + 1 : position + 4], "little")


def iter_lz13_blobs(data: bytes, position: int, limit: int | None = None):
    """Yield (start, length) for consecutive LZ13 blobs from ``position``."""
    while position + 8 <= len(data):
        length = lz13_blob_length(data, position)
        if not length or position + length > len(data):
            break
        yield position, length
        position += length
        if limit is not None and length == 0:
            break


# ----------------------------- BinArchive ----------------------------------


class BinArchive:
    def __init__(self, raw: bytes):
        if len(raw) < 0x20:
            raise AssetError("archive too small")
        self.raw = raw
        self.size, self.data_size, self.pointer_count, self.label_count = struct.unpack_from(
            "<IIII", raw, 0
        )
        self.data_offset = 0x20
        pointer_table = self.data_offset + self.data_size
        label_table = pointer_table + self.pointer_count * 4
        self.text_start = label_table + self.label_count * 8

        self.pointers: dict[int, int] = {}
        for i in range(self.pointer_count):
            address = struct.unpack_from("<I", raw, pointer_table + i * 4)[0]
            if address + 4 <= self.data_size:
                self.pointers[address] = struct.unpack_from(
                    "<I", raw, self.data_offset + address
                )[0]

        self.labels: dict[int, list[str]] = {}
        for i in range(self.label_count):
            address, text_offset = struct.unpack_from("<II", raw, label_table + i * 8)
            self.labels.setdefault(address, []).append(self.read_text(text_offset))

    def read_text(self, text_offset: int) -> str:
        start = self.text_start + text_offset
        end = self.raw.index(b"\x00", start)
        return self.raw[start:end].decode("shift_jis", errors="replace")

    def read_string(self, address: int) -> str | None:
        value = self.pointers.get(address)
        if value is None:
            return None
        if value > self.data_size:
            start = value + self.data_offset
            end = self.raw.index(b"\x00", start)
            return self.raw[start:end].decode("shift_jis", errors="replace")
        return None

    def read_bytes(self, address: int, length: int) -> bytes:
        start = self.data_offset + address
        return self.raw[start : start + length]


# -------------------------------- BCH --------------------------------------


def _u16(data: bytes, offset: int) -> int:
    return struct.unpack_from("<H", data, offset)[0]


def _u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


class BchTexture:
    def __init__(self, name: str, width: int, height: int, rgba: bytes):
        self.name = name
        self.width = width
        self.height = height
        self.rgba = rgba


def bch_textures(raw: bytes) -> list[BchTexture]:
    """Decode every texture in a BCH file (the texture sections of H3D)."""
    if raw[:4] != b"BCH\x00":
        raise AssetError("not a BCH file")
    backward = raw[4]
    contents_address = _u32(raw, 8)
    strings_address = _u32(raw, 12)
    commands_address = _u32(raw, 16)
    raw_data_address = _u32(raw, 20)

    textures_ptr_table_offset = _u32(raw, contents_address + 0x24) + contents_address
    entry_count = _u32(raw, contents_address + 0x28)
    if entry_count > 4096:
        raise AssetError(f"implausible BCH texture count {entry_count}")

    textures: list[BchTexture] = []
    for entry in range(entry_count):
        dest = _u32(raw, textures_ptr_table_offset + entry * 4)
        record = contents_address + dest
        commands_offset = _u32(raw, record) + commands_address
        name_offset = _u32(raw, record + 28)
        name_start = strings_address + name_offset
        name_end = raw.index(b"\x00", name_start)
        name = raw[name_start:name_end].decode("utf-8", errors="replace")

        height = _u16(raw, commands_offset)
        width = _u16(raw, commands_offset + 2)
        data_offset = _u32(raw, commands_offset + 0x10) + raw_data_address
        pixel_format = _u32(raw, commands_offset + 0x18)
        bpp = _format_bpp(pixel_format)
        pixel_data = raw[data_offset : data_offset + int(bpp * width * height)]
        rgba = decode_pixels(pixel_data, width, height, pixel_format)
        textures.append(BchTexture(name, width, height, rgba))
    return textures


# -------------------------------- CTPK -------------------------------------


def ctpk_textures(raw: bytes) -> list[BchTexture]:
    """Decode every texture in a CTPK package."""
    if raw[:4] != b"CTPK":
        raise AssetError("not a CTPK file")
    texture_count = _u16(raw, 6)
    texture_ptr = _u32(raw, 8)
    if texture_count > 4096:
        raise AssetError(f"implausible CTPK texture count {texture_count}")
    textures: list[BchTexture] = []
    for index in range(texture_count):
        info = _u32(raw, texture_ptr + index * 40)
        if info == 0:
            continue
        name_ptr = _u32(raw, info)
        data_ptr = _u32(raw, info + 8)
        pixel_format = _u32(raw, info + 12)
        width = _u16(raw, info + 16)
        height = _u16(raw, info + 18)
        end = raw.index(b"\x00", name_ptr)
        name = raw[name_ptr:end].decode("shift_jis", errors="replace")
        bpp = _format_bpp(pixel_format)
        pixel_data = raw[data_ptr : data_ptr + int(bpp * width * height)]
        textures.append(BchTexture(name, width, height, decode_pixels(pixel_data, width, height, pixel_format)))
    return textures


# ------------------------------ pixel data ---------------------------------

# PICA200 8x8 tile order: storage position -> linear pixel index in the tile.
TILE_ORDER = (
    0, 1, 8, 9, 2, 3, 10, 11, 16, 17, 24, 25, 18, 19, 26, 27,
    4, 5, 12, 13, 6, 7, 14, 15, 20, 21, 28, 29, 22, 23, 30, 31,
    32, 33, 40, 41, 34, 35, 42, 43, 48, 49, 56, 57, 50, 51, 58, 59,
    36, 37, 44, 45, 38, 39, 46, 47, 52, 53, 60, 61, 54, 55, 62, 63,
)

CONVERT_5_TO_8 = (
    0x00, 0x08, 0x10, 0x18, 0x20, 0x29, 0x31, 0x39, 0x41, 0x4A, 0x52, 0x5A,
    0x62, 0x6A, 0x73, 0x7B, 0x83, 0x8B, 0x94, 0x9C, 0xA4, 0xAC, 0xB4, 0xBD,
    0xC5, 0xCD, 0xD5, 0xDE, 0xE6, 0xEE, 0xF6, 0xFF,
)


def _format_bpp(pixel_format: int) -> float:
    if pixel_format == 0:
        return 4.0
    if pixel_format == 1:
        return 3.0
    if 2 <= pixel_format <= 5:
        return 2.0
    if pixel_format in (6, 7, 8, 9, 11, 13):
        return 1.0
    if pixel_format in (10, 12):
        return 0.5
    raise AssetError(f"unsupported pixel format {pixel_format}")


def _color_to_rgba(value: int, pixel_format: int) -> bytes:
    if pixel_format == 0:
        return bytes(((value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF))
    if pixel_format == 1:
        return bytes(((value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF, 0xFF))
    if pixel_format == 2:
        return bytes(
            (
                CONVERT_5_TO_8[(value >> 11) & 0x1F],
                CONVERT_5_TO_8[(value >> 6) & 0x1F],
                CONVERT_5_TO_8[(value >> 1) & 0x1F],
                0xFF if value & 1 else 0,
            )
        )
    if pixel_format == 3:
        return bytes(
            (
                CONVERT_5_TO_8[(value >> 11) & 0x1F],
                ((value >> 5) & 0x3F) * 4,
                CONVERT_5_TO_8[value & 0x1F],
                0xFF,
            )
        )
    if pixel_format == 4:
        r, g, b, a = (value >> 12) & 0xF, (value >> 8) & 0xF, (value >> 4) & 0xF, value & 0xF
        return bytes((r | (r << 4), g | (g << 4), b | (b << 4), a | (a << 4)))
    if pixel_format == 5:
        red = (value >> 8) & 0xFF
        return bytes((red, red, red, value & 0xFF))
    if pixel_format == 6:
        red = (value >> 8) & 0xFF
        return bytes((red, red, red, 0xFF))
    if pixel_format == 7:
        return bytes((value & 0xFF,) * 3 + (0xFF,))
    if pixel_format == 8:
        return bytes((0xFF, 0xFF, 0xFF, value & 0xFF))
    if pixel_format == 9:
        red = (value >> 4) & 0xFF
        return bytes((red, red, red, value & 0xF))
    if pixel_format == 10:
        red = (value & 0xF) * 0x11
        return bytes((red, red, red, 0xFF))
    if pixel_format == 11:
        return bytes((0xFF, 0xFF, 0xFF, (value & 0xF) * 0x11))
    raise AssetError(f"unsupported pixel format {pixel_format}")


def decode_pixels(data: bytes, width: int, height: int, pixel_format: int) -> bytes:
    if pixel_format in (12, 13):
        return _decode_etc1(data, width, height, pixel_format == 13)
    if not 0 <= pixel_format <= 11:
        raise AssetError(f"unsupported pixel format {pixel_format}")

    bpp = int(_format_bpp(pixel_format))
    out = bytearray(width * height * 4)
    position = 0
    for tile_y in range(height // 8):
        for tile_x in range(width // 8):
            for storage in range(64):
                linear = TILE_ORDER[storage]
                x = linear % 8
                y = linear // 8
                value = int.from_bytes(data[position : position + bpp], "little")
                position += bpp
                rgba = _color_to_rgba(value, pixel_format)
                target = ((tile_y * 8 + y) * width + tile_x * 8 + x) * 4
                out[target : target + 4] = rgba
    return bytes(out)


ETC_MODIFIERS = (
    (2, 8), (5, 17), (9, 29), (13, 42), (18, 60), (24, 80), (33, 106), (47, 183),
)


def _decode_etc1(data: bytes, width: int, height: int, with_alpha: bool) -> bytes:
    """Decode 3DS ETC1 (8 bytes/block) or ETC1A4 (16 bytes/block).

    Two PICA200 quirks separate this from stock ETC1 (GBATEK "3DS GPU Texture
    Formats"): blocks are stored little-endian, and the 16 pixel modifier
    indices inside each 4x4 block are ordered column-major (x*4+y), as is the
    4-bit alpha plane in ETC1A4.
    """
    out = bytearray(width * height * 4)
    block_size = 16 if with_alpha else 8
    block_cols = (width + 3) // 4
    block_rows = (height + 3) // 4
    offset = 0
    # 8x8 pixel tiles hold four 4x4 blocks in Z-order; tiles run left-to-right.
    for tile_y in range((block_rows + 1) // 2):
        for tile_x in range((block_cols + 1) // 2):
            for sub_x, sub_y in ((0, 0), (1, 0), (0, 1), (1, 1)):
                block_x = tile_x * 2 + sub_x
                block_y = tile_y * 2 + sub_y
                block = data[offset : offset + block_size]
                offset += block_size
                if block_x >= block_cols or block_y >= block_rows:
                    continue
                if len(block) < block_size:
                    return bytes(out)
                if with_alpha:
                    alpha_bits = int.from_bytes(block[:8], "little")
                    colors = _etc1_block_rgb(block[8:])
                else:
                    alpha_bits = None
                    colors = _etc1_block_rgb(block)
                for py in range(4):
                    for px in range(4):
                        x = block_x * 4 + px
                        y = block_y * 4 + py
                        if x >= width or y >= height:
                            continue
                        target = (y * width + x) * 4
                        index = (px * 4 + py) * 3
                        out[target : target + 3] = colors[index : index + 3]
                        out[target + 3] = (
                            (((alpha_bits >> ((px * 4 + py) * 4)) & 0xF) * 0x11)
                            if alpha_bits is not None
                            else 0xFF
                        )
    return bytes(out)


def _etc1_block_rgb(block: bytes) -> bytes:
    """RGB bytes for one 4x4 ETC1 block, with 3DS column-major pixel order."""
    value = int.from_bytes(block, "little")
    color_word = (value >> 32) & 0xFFFFFFFF
    index_word = value & 0xFFFFFFFF

    differential = (color_word >> 1) & 1
    horizontal = color_word & 1
    table1 = ETC_MODIFIERS[(color_word >> 5) & 7]
    table2 = ETC_MODIFIERS[(color_word >> 2) & 7]

    if differential:
        r1, g1, b1 = (color_word >> 27) & 0x1F, (color_word >> 19) & 0x1F, (color_word >> 11) & 0x1F
        r2 = (r1 + _signed((color_word >> 24) & 7, 3)) & 0x1F
        g2 = (g1 + _signed((color_word >> 16) & 7, 3)) & 0x1F
        b2 = (b1 + _signed((color_word >> 8) & 7, 3)) & 0x1F
        color1 = (_expand5(r1), _expand5(g1), _expand5(b1))
        color2 = (_expand5(r2), _expand5(g2), _expand5(b2))
    else:
        r1, g1, b1 = (color_word >> 28) & 0xF, (color_word >> 20) & 0xF, (color_word >> 12) & 0xF
        r2, g2, b2 = (color_word >> 24) & 0xF, (color_word >> 16) & 0xF, (color_word >> 8) & 0xF
        color1 = (_expand4(r1), _expand4(g1), _expand4(b1))
        color2 = (_expand4(r2), _expand4(g2), _expand4(b2))

    out = bytearray(48)
    for py in range(4):
        for px in range(4):
            bit = px * 4 + py
            use_second = (px >= 2) if not horizontal else (py >= 2)
            table = table2 if use_second else table1
            color = color2 if use_second else color1
            amount = table[(index_word >> bit) & 1]
            if (index_word >> (bit + 16)) & 1:
                amount = -amount
            index = (px * 4 + py) * 3
            out[index] = max(0, min(255, color[0] + amount))
            out[index + 1] = max(0, min(255, color[1] + amount))
            out[index + 2] = max(0, min(255, color[2] + amount))
    return bytes(out)


def _signed(value: int, bits: int) -> int:
    return value - (1 << bits) if value >> (bits - 1) else value


def _expand5(value: int) -> int:
    return (value << 3) | (value >> 2)


def _expand4(value: int) -> int:
    return value * 0x11

