"""Offline HPE L&TT support-code format, reconstructed from Windows L&TT 6.7.

This utility only works with strings. It never opens a tape device or flashes firmware.
See FORMAT.md for the encoding and verification notes.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from datetime import date, timedelta
import json

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTUVWXY"
XOR_MASK = 0xDEADBEEF
EPOCHS = {0: date(2000, 1, 1), 1: date(2022, 1, 1)}
PUBLIC_SUPPORT_FLAGS = 0x000207  # Present in all seven public HP support samples.


def crc32_bzip2(data: bytes) -> int:
    """MSB-first CRC-32: polynomial 04C11DB7, initial/final XOR FFFFFFFF."""
    crc = 0xFFFFFFFF
    for byte in data:
        crc ^= byte << 24
        for _ in range(8):
            crc = ((crc << 1) ^ (0x04C11DB7 if crc & 0x80000000 else 0)) & 0xFFFFFFFF
    return crc ^ 0xFFFFFFFF


def checksum(flags: int, day: int, duration: int, epoch: int, extra: int | None = None) -> int:
    data = bytes(((epoch << 5) | (day >> 8), day & 255,
                  (flags >> 16) & 255, (flags >> 8) & 255, flags & 255, duration))
    if extra is not None:
        data += bytes((extra,))
    return crc32_bzip2(data * 100)


def decode_word(text: str) -> int:
    if len(text) != 7 or any(c not in ALPHABET for c in text.upper()):
        raise ValueError("each block must contain 7 characters from " + ALPHABET)
    value = 0
    for char in text.upper():
        value = ((value << 5) | ALPHABET.index(char)) & 0xFFFFFFFF
    return value ^ XOR_MASK


def encode_word(value: int) -> str:
    value ^= XOR_MASK
    return "".join(ALPHABET[(value >> shift) & 31] for shift in range(30, -1, -5))


@dataclass(frozen=True)
class Decoded:
    code: str
    epoch: int
    day: int
    start_date: str
    duration: int
    last_valid_date: str | None
    flags: int
    extra: int | None
    checksum_valid: bool
    valid_on_date: bool


def decode(code: str, on: date | None = None) -> Decoded:
    code = code.strip().upper()
    if len(code) not in (14, 21):
        raise ValueError("expected a 14- or 21-character code")
    a = decode_word(code[:7])
    b = decode_word(code[-7:])
    epoch, day = a >> 29, (a >> 16) & 0x1FFF
    if epoch not in EPOCHS:
        raise ValueError(f"unsupported epoch selector {epoch}")
    flags, duration = b >> 8, b & 255
    extra = None
    stored = a & 0xFFFF
    if len(code) == 21:
        mid = decode_word(code[7:14])
        extra = mid & 255
        stored = ((a & 0xFF00) << 16) | ((mid >> 8) & 0xFFFF00) | (a & 255)
    calculated = checksum(flags, day, duration, epoch, extra)
    if len(code) == 14:
        calculated = ((calculated >> 16) & 0xFF00) | (calculated & 255)
    good = calculated == stored
    start = EPOCHS[epoch] + timedelta(days=day)
    last = start + timedelta(days=duration) if duration else None
    today = on or date.today()
    return Decoded(code, epoch, day, start.isoformat(), duration,
                   last.isoformat() if last else None, flags, extra, good,
                   good and today >= start and (last is None or today <= last))


def generate(start: date, duration: int = 2, flags: int = PUBLIC_SUPPORT_FLAGS,
             epoch: int | None = None, extra: int | None = None) -> str:
    if epoch is None:
        epoch = 1 if start >= EPOCHS[1] else 0
    if epoch not in EPOCHS:
        raise ValueError("epoch must be 0 or 1")
    day = (start - EPOCHS[epoch]).days
    if not 0 <= day <= 0x1FFF:
        raise ValueError("date is outside this epoch's 13-bit day range")
    if not 0 <= duration <= 255:
        raise ValueError("duration must be 0..255 (0 means no expiry)")
    if not 0 <= flags <= 0xFFFFFF:
        raise ValueError("flags must fit in 24 bits")
    if extra is not None and not 0 <= extra <= 255:
        raise ValueError("extra must fit in 8 bits")
    crc = checksum(flags, day, duration, epoch, extra)
    a = (epoch << 29) | (day << 16) | ((crc >> 16) & 0xFF00) | (crc & 255)
    b = (flags << 8) | duration
    middle = "" if extra is None else encode_word(((crc & 0xFFFF00) << 8) | extra)
    return encode_word(a) + middle + encode_word(b)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    gen = commands.add_parser("generate", help="create an offline support code")
    gen.add_argument("--date", type=date.fromisoformat, default=date.today())
    gen.add_argument("--days", type=int, default=2, help="validity offset; end date is inclusive")
    gen.add_argument("--flags", type=lambda s: int(s, 0), default=PUBLIC_SUPPORT_FLAGS)
    gen.add_argument("--epoch", type=int, choices=(0, 1))
    gen.add_argument("--extra", type=lambda s: int(s, 0), help="generate extended 21-character format")
    dec = commands.add_parser("decode", help="inspect a code and check its checksum")
    dec.add_argument("code")
    dec.add_argument("--on", type=date.fromisoformat, default=date.today())
    args = parser.parse_args()
    try:
        if args.command == "generate":
            print(generate(args.date, args.days, args.flags, args.epoch, args.extra))
        else:
            print(json.dumps(asdict(decode(args.code, args.on)), indent=2))
    except ValueError as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
