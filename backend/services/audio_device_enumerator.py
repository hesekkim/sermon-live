from __future__ import annotations

import argparse
import json

from services.audio_devices import _list_input_devices_in_current_process


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("standard", "all"))
    args = parser.parse_args()
    devices = _list_input_devices_in_current_process(args.mode)
    print(json.dumps(devices, ensure_ascii=False))


if __name__ == "__main__":
    main()
