from dataclasses import asdict
from datetime import date
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ltt_password import generate, decode

cases = []
for start in (date(2000, 1, 1), date(2007, 11, 21), date(2021, 12, 31),
              date(2022, 1, 1), date(2024, 2, 29), date(2026, 9, 25)):
    for duration in (0, 2, 20, 255):
        for flags in (0, 0x207, 0xFFFFFF):
            for extra in (None, 5, 255):
                code = generate(start, duration, flags, extra=extra)
                cases.append({"date": str(start), "duration": duration,
                              "flags": flags, "epoch": None, "extra": extra,
                              "code": code, "decoded": asdict(decode(code, start))})
print(json.dumps(cases))
