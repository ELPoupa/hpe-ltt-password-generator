# Support-code format

The implementation comes from analysis of the Windows HPE L&TT 6.7 validator
and comparison with codes posted publicly on HP’s support forum. The goal was
to recover access to maintenance options on old tape hardware.

## Scope of verification

The examined executable reports version `6,7,0,8`. Its SHA-256 is:

```text
208295c9abbf0683471589302586b825751c5cc08292170ce041446cfbd67bd8
```

The executable was extracted from the [HPE 6.7 Windows installer](https://downloads.hpe.com/pub/softlib2/software1/pubsw-generic/p1910951539/v281799/hpe_ltt67_win.exe).
Both the installer and executable had valid HPE Authenticode signatures at the
time of analysis. Neither is included here.

The original validator was executed in Unicorn with C/C++ runtime services
shimmed: allocation, string handling, memory copying, uppercasing and clock
functions. The actual decoding, CRC, date comparisons and acceptance branches
ran from the unmodified executable. Twenty cases passed, covering historical
samples, a current code, malformed input, validity boundaries and both formats.
This did not run the complete application or exercise a tape drive.

## Ordinary codes

The 14-character code consists of two seven-character base-32 words. The alphabet
is `0123456789ABCDEFGHJKMNPQRSTUVWXY`. Decode each word to a 32-bit unsigned
integer and XOR it with `0xDEADBEEF`.

| Field | Location |
| --- | --- |
| Epoch selector | First word, bits 29–31 |
| Start-day offset | First word, bits 16–28 |
| Checksum | First word, bits 0–15 |
| Permission mask | Second word, bits 8–31 |
| Validity offset | Second word, bits 0–7 |

Epoch 0 starts on 2000-01-01. Epoch 1 starts on 2022-01-01. The validator accepts
only these selectors. The 13-bit start offset must fit in 0–8191.

Build the following six bytes and repeat them one hundred times:

```text
[(epoch << 5) | (day >> 8), day & 255,
 (permissions >> 16) & 255, (permissions >> 8) & 255,
 permissions & 255, validity]
```

Compute CRC-32/BZIP2: polynomial `0x04C11DB7`, initial value `0xFFFFFFFF`,
no reflection, final XOR `0xFFFFFFFF`. The checksum stored in an ordinary code
keeps the CRC’s top and bottom bytes:

```text
((crc >> 16) & 0xFF00) | (crc & 0xFF)
```

Assemble the fields, XOR each word again and encode each as seven characters.
The implementation contains no per-PC, serial-number or drive-generation input.

## Dates and permissions

The final date is included: `start <= current_day <= start + validity`.
A validity byte of zero means no expiration. The website exposes only temporary
two-day and twenty-day codes; the Python tool supports the full field range.

All seven public samples used mask `0x207`, which is also the default here.
The analyzed UI tests mask `0x2` for the drive product-ID control and `0x4` for
arbitrary drive firmware selection. A support code enables options in L&TT;
it does not guarantee acceptance by the drive itself.

L&TT computes day offsets from elapsed 86,400-second intervals after a local
`mktime` epoch with `tm_isdst=0`, using a 32-bit subtraction. The generators show
calendar dates. Near a daylight-saving boundary, the application can disagree
with a calendar date briefly. The clock in the emulator was fixed to UTC noon;
no system-clock changes were needed.

## Public reference codes

| Code | Start | Encoded validity | Source |
| --- | --- | --- | --- |
| `3D6PYV03FAYEFS` | 2003-05-07 | 22 | [C6364A firmware](https://community.hpe.com/t5/hpe-storeever-tape-storage/c6364a-firmware/td-p/220818) |
| `3A9Y1E93FAYEFS` | 2007-02-23 | 22 | [SureStore DLT](https://community.hpe.com/t5/hpe-storeever-tape-storage/surestore-dlt-1-8-tape-library/m-p/3950001/highlight/true) |
| `3A9NSH93FAYEFS` | 2007-02-28 | 22 | [MSL6030](https://community.hpe.com/t5/hpe-storeever-tape-storage/msl6030-lto2-drive-failed-after-firmware-upgrade/td-p/3952837) |
| `3AEPWJH3FAYEFB` | 2007-03-15 | 4 | [Ultrium 1](https://community.hpe.com/t5/hpe-storeever-tape-storage/ultrium-1-failed-l-amp-tt-read-write-test/td-p/3963183) |
| `3A11H973FAYEFB` | 2007-07-12 | 4 | [Ultrium 460](https://community.hpe.com/t5/hpe-storeever-tape-storage/hp-msl-6030-1-ultrium-460-media-error-after-firmware-upgrade/td-p/5057429) |
| `3AXRR5V3FAYEFB` | 2007-11-21 | 4 | [Ultrium 448](https://community.hpe.com/t5/hpe-storeever-tape-storage/password-for-firmware-downgrade-on-hp-ultrium-448/td-p/4105672) |
| `39KBE6A3FAYEFB` | 2009-07-12 | 4 | [StorageWorks DAT72](https://community.hpe.com/t5/hpe-storeever-tape-storage/storageworks-data72-won-t-load-tape-after-firmware-upgrade/td-p/1093816) |

The replies advertising two-day and twenty-day codes actually encoded offsets
of four and twenty-two days. The reason for the extra allowance is unknown.
This project's `--days` parameter is the literal offset, with no hidden allowance.
The samples also cover tape products outside the LTO family.

## Extended codes

The 21-character format inserts a third word between the date and permission
words. Its low byte is an extra field appended to the checksum input. All seven
bytes are repeated one hundred times. The complete CRC is compared with:

```text
((first & 0xFF00) << 16) | ((middle >> 8) & 0xFFFF00) | (first & 0xFF)
```

The middle word’s bits 8–15 are unused in this path. Its low byte’s operational
meaning has not been established. Extended codes are covered by the core library
and Python tool, but are not needed by the website’s standard support-code flow.

## Useful addresses

For the exact executable hash above, at image base `0x400000`:

| Address | Function |
| --- | --- |
| `0x4C69C0` | Password validator |
| `0x4C656E` | Seven-character word decoder |
| `0x4C631C` | Ordinary checksum input |
| `0x4C6275` | Extended checksum input |
| `0x4B912D` | CRC implementation |
| `0x737EDC` | Alphabet |
| `0x48E0B8` | Permission-mask check |

The implementation deliberately rejects invalid alphabet characters rather
than reproducing the original decoder’s character-skipping behavior. Legacy
password aliases and other L&TT releases were not investigated.
