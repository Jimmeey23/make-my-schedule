import re

import pandas as pd


GOOGLE_SHEETS_SERIAL_ORIGIN = "1899-12-30"


def parse_google_sheet_dates(values: pd.Series) -> pd.Series:
    """Parse Google Sheets Date values rendered as strings or serial numbers."""
    parsed = pd.to_datetime(values.astype(str).str.strip(), errors="coerce", format="mixed")
    numeric_values = pd.to_numeric(values, errors="coerce")
    serial_mask = parsed.isna() & numeric_values.notna()
    if serial_mask.any():
        parsed.loc[serial_mask] = pd.to_datetime(
            numeric_values.loc[serial_mask],
            errors="coerce",
            unit="D",
            origin=GOOGLE_SHEETS_SERIAL_ORIGIN,
        )
    return parsed


def normalize_google_sheet_time(value) -> str:
    """Normalize Sheets time values rendered as HH:MM strings or day fractions."""
    if pd.isna(value):
        return ""

    text = str(value).strip()
    match = re.match(r"^(\d{1,2}):(\d{2})", text)
    if match:
        return f"{int(match.group(1)):02d}:{match.group(2)}"

    numeric = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.notna(numeric):
        minutes = int(round(float(numeric % 1) * 24 * 60)) % (24 * 60)
        return f"{minutes // 60:02d}:{minutes % 60:02d}"

    return text[:5]
