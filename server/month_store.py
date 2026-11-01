"""Reads and writes month files: data/YYYY-MM.json."""
import json
import os
import re
import tempfile
from pathlib import Path

MONTH_KEY_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class InvalidMonthKeyError(ValueError):
    """The month key isn't in YYYY-MM form."""


class InvalidMonthDataError(ValueError):
    """The data isn't a month record for the given month."""


class MonthStore:
    """One JSON file per month in a folder. Month keys look like "2026-09"."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(exist_ok=True)

    @staticmethod
    def is_valid_month_key(month_key: str) -> bool:
        return bool(MONTH_KEY_PATTERN.match(month_key))

    def list_month_keys(self) -> list:
        """Saved months, oldest first."""
        return sorted(
            month_file.stem
            for month_file in self.data_dir.glob("*.json")
            if self.is_valid_month_key(month_file.stem)
        )

    def load(self, month_key: str):
        """The month's data, or None when the month has no file."""
        month_file = self._path_for(month_key)
        if not month_file.exists():
            return None
        return json.loads(month_file.read_text(encoding="utf-8"))

    def save(self, month_key: str, month_data: dict) -> None:
        """Replaces the month's file. A crash mid-write leaves the previous file intact."""
        month_file = self._path_for(month_key)
        self._validate(month_key, month_data)

        file_descriptor, temporary_path = tempfile.mkstemp(dir=self.data_dir, suffix=".tmp")
        try:
            with os.fdopen(file_descriptor, "w", encoding="utf-8") as temporary_file:
                json.dump(month_data, temporary_file, indent=2, ensure_ascii=False)
            os.replace(temporary_path, month_file)  # atomic on the same disk
        except BaseException:
            Path(temporary_path).unlink(missing_ok=True)
            raise

    def _path_for(self, month_key: str) -> Path:
        # The pattern check guarantees the path stays inside data_dir.
        if not self.is_valid_month_key(month_key):
            raise InvalidMonthKeyError(f"month must look like 2026-09, got {month_key!r}")
        return self.data_dir / f"{month_key}.json"

    @staticmethod
    def _validate(month_key: str, month_data) -> None:
        if not isinstance(month_data, dict):
            raise InvalidMonthDataError("month data must be a JSON object")
        if month_data.get("month") != month_key:
            raise InvalidMonthDataError(f"month data is for {month_data.get('month')!r}, not {month_key!r}")
        if not isinstance(month_data.get("expenses"), list):
            raise InvalidMonthDataError("month data must contain an expenses list")
