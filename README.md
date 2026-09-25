# HPE L&TT Password Generator

Generate temporary support passwords for **HPE Library & Tape Tools (L&TT) 6.7**.
These codes enable support options used when maintaining LTO tape drives, including
firmware downgrades, product-ID overrides and manual firmware selection.

<p>
  <a href="https://elpoupa.github.io/hpe-ltt-password-generator/?v=2">
    <img src="assets/get-code.svg" width="370" height="64" alt="Get current LTO support code">
  </a>
</p>

## Using a code

1. Copy the code.
2. Enter it in L&TT’s **Support Password** dialog.
3. Select the support overrides needed for your drive.

Check that your PC’s date is correct. The displayed final date is included in the
validity period. You can switch between two and twenty days or choose a start date.

The password is not tied to a PC, serial number or LTO generation. It unlocks
options in L&TT; it does **not** establish that a firmware image is compatible
with your drive. An incorrect crossflash can leave a drive unusable.

## Run it locally

Python 3.10 or newer, with no additional packages:

```sh
python ltt_password.py generate --days 20
```

Use a specific start date, or inspect an existing code:

```sh
python ltt_password.py generate --date 2026-09-25 --days 20
python ltt_password.py decode 3V6UUEX3FAYEFU
```

On Windows, there is also a PowerShell launcher:

```powershell
.\Get-LTTPassword.ps1 -Days 20
```

To run the website locally:

```sh
python -m http.server 8000 --directory docs
```

Then open <http://localhost:8000>. The site is plain HTML, CSS and JavaScript;
there is no build step and no application server. GitHub Pages serves `docs/`
from the `main` branch.

## License and project notice

The generator source is available under the [MIT license](LICENSE). This is an
independent repair and interoperability project, not affiliated with or endorsed
by HP or HPE. Product names identify the software and hardware being discussed.

No HPE installers, executables, firmware images or proprietary source files are
distributed in this repository. See [NOTICE.md](NOTICE.md) for scope and attribution.
