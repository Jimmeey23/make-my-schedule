import json
import os
import base64
from datetime import date
from urllib.parse import parse_qs, urlparse
import pandas as pd
import numpy as np
from pathlib import Path

from agents.sheet_value_utils import normalize_google_sheet_time, parse_google_sheet_dates

try:
    from google.auth.exceptions import RefreshError as GoogleRefreshError
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2.credentials import Credentials as GoogleUserCredentials
    from google.oauth2.service_account import Credentials as GoogleServiceAccountCredentials
    from googleapiclient.discovery import build as google_build
    from googleapiclient.errors import HttpError as GoogleHttpError
except Exception:  # pragma: no cover - optional dependency fallback
    GoogleRefreshError = None
    GoogleAuthRequest = None
    GoogleUserCredentials = None
    GoogleServiceAccountCredentials = None
    google_build = None
    GoogleHttpError = None

STATE_DIR = Path("state")
VALID_LOCATIONS = [
    "Kwality House, Kemps Corner",
    "Supreme HQ, Bandra",
    "Kenkere House",
    "Copper & Cloves",
]
GOOGLE_SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
DEFAULT_GOOGLE_SHEET_RANGE = "A1:Z50000"
PREFERRED_SESSIONS_SHEET_TITLES = ("Sessions Sheet", "Sessions", "Session Data")
REQUIRED_SESSION_COLUMNS = {
    "Date",
    "Time",
    "Trainer",
    "Class",
    "Location",
    "CheckedIn",
    "Capacity",
    "Booked",
    "LateCancelled",
    "Revenue",
}


def historic_cutoff_date() -> pd.Timestamp:
    raw = os.environ.get("HISTORIC_COMPLETED_CUTOFF_DATE") or date.today().isoformat()
    return pd.Timestamp(raw).normalize()


def copper_class_name(row) -> str:
    session = str(row.get("SessionName", "") or "").lower()
    class_name = str(row.get("Class", "") or "")
    source = f"{session} {class_name.lower()}"
    if "fit" in source:
        return "Copper + Cloves FIT"
    if "mat 57" in source or "mat57" in source:
        return "Copper + Cloves Mat 57"
    return "Copper + Cloves Barre 57"


def time_band(time_str: str) -> str:
    try:
        h = int(str(time_str)[:2])
    except (ValueError, TypeError):
        return "unknown"
    if 7 <= h <= 9:
        return "morning"
    elif 10 <= h <= 12:
        return "midday"
    elif 13 <= h <= 16:
        return "afternoon"
    else:
        return "evening"


class DataIngestor:
    def __init__(self, csv_path: Path | str):
        self.csv_path = str(csv_path)
        self._last_source_info: dict = {}

    def _source_is_url(self) -> bool:
        return self.csv_path.startswith(("http://", "https://"))

    def _google_sheet_export_url(self) -> str:
        source = self.csv_path.strip()
        parsed = urlparse(source)
        if "docs.google.com" not in parsed.netloc:
            return source
        if "/export" in parsed.path and "format=csv" in parsed.query:
            return source
        parts = parsed.path.split("/")
        spreadsheet_id = ""
        if "d" in parts:
            try:
                spreadsheet_id = parts[parts.index("d") + 1]
            except Exception:
                spreadsheet_id = ""
        gid = parse_qs(parsed.query).get("gid", [""])[0]
        if not spreadsheet_id:
            return source
        export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv"
        if gid:
            export_url += f"&gid={gid}"
        return export_url

    def _looks_like_google_sheet(self) -> bool:
        parsed = urlparse(self.csv_path.strip())
        return "docs.google.com" in parsed.netloc

    def _google_sheet_target(self) -> tuple[str, int | None] | None:
        source = self.csv_path.strip()
        parsed = urlparse(source)
        if "docs.google.com" not in parsed.netloc:
            return None
        parts = parsed.path.split("/")
        if "d" not in parts:
            return None
        try:
            spreadsheet_id = parts[parts.index("d") + 1]
        except Exception:
            return None
        gid_value = parse_qs(parsed.query).get("gid", [""])[0] or parse_qs(parsed.fragment).get("gid", [""])[0]
        try:
            gid = int(gid_value) if gid_value else None
        except ValueError:
            gid = None
        return spreadsheet_id, gid

    def _load_google_credentials(self):
        service_account_json = (
            os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
            or os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64")
            or os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE")
        )
        if service_account_json:
            if GoogleServiceAccountCredentials is None:
                raise RuntimeError(
                    "google-auth dependencies are missing. Install google-auth and google-api-python-client."
                )
            service_account_json = service_account_json.strip()
            if service_account_json.startswith("{"):
                info = json.loads(service_account_json)
                return GoogleServiceAccountCredentials.from_service_account_info(
                    info,
                    scopes=GOOGLE_SHEETS_SCOPES,
                )
            if os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"):
                info = json.loads(base64.b64decode(service_account_json).decode("utf-8"))
                return GoogleServiceAccountCredentials.from_service_account_info(
                    info,
                    scopes=GOOGLE_SHEETS_SCOPES,
                )
            return GoogleServiceAccountCredentials.from_service_account_file(
                service_account_json,
                scopes=GOOGLE_SHEETS_SCOPES,
            )

        client_id = os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("GSHEETS_CLIENT_ID")
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET") or os.environ.get("GSHEETS_CLIENT_SECRET")
        refresh_token = os.environ.get("GOOGLE_REFRESH_TOKEN") or os.environ.get("GSHEETS_REFRESH_TOKEN")
        if client_id and client_secret and refresh_token:
            if GoogleUserCredentials is None:
                raise RuntimeError(
                    "google-auth dependencies are missing. Install google-auth and google-api-python-client."
                )
            credentials = GoogleUserCredentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=client_id,
                client_secret=client_secret,
            )
            if GoogleAuthRequest is not None:
                try:
                    credentials.refresh(GoogleAuthRequest())
                except Exception as exc:
                    if (GoogleRefreshError is not None and isinstance(exc, GoogleRefreshError)) or "invalid_client" in str(exc):
                        raise RuntimeError(
                            "Google Sheets OAuth credentials are invalid: the OAuth client was not found. "
                            "Fix GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN, or set "
                            "GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 for the service account "
                            "that has access to the spreadsheet."
                        ) from exc
                    raise
            return credentials

        return None

    def _sheet_dataframe(self, service, spreadsheet_id: str, sheet_title: str) -> pd.DataFrame:
        escaped_title = sheet_title.replace("'", "''")
        range_name = f"'{escaped_title}'!{DEFAULT_GOOGLE_SHEET_RANGE}"
        values = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            majorDimension="ROWS",
            valueRenderOption="UNFORMATTED_VALUE",
        ).execute().get("values", [])

        if not values:
            return pd.DataFrame()

        header = [str(col).strip() for col in values[0]]
        rows = []
        header_len = len(header)
        for row in values[1:]:
            normalized = list(row[:header_len])
            if len(normalized) < header_len:
                normalized.extend([""] * (header_len - len(normalized)))
            rows.append(normalized)
        return pd.DataFrame(rows, columns=header)

    def _session_schema_score(self, df: pd.DataFrame) -> int:
        columns = {str(col).strip() for col in df.columns}
        return sum(1 for col in REQUIRED_SESSION_COLUMNS if col in columns)

    def _is_unparseable_sheet_range_error(self, exc: Exception) -> bool:
        if GoogleHttpError is not None and not isinstance(exc, GoogleHttpError):
            return False
        status = getattr(getattr(exc, "resp", None), "status", None)
        return status == 400 and "Unable to parse range" in str(exc)

    def _is_sessions_dataframe(self, df: pd.DataFrame) -> bool:
        return self._session_schema_score(df) == len(REQUIRED_SESSION_COLUMNS)

    def _fetch_google_sheet_dataframe(self) -> pd.DataFrame | None:
        target = self._google_sheet_target()
        if not target:
            return None
        spreadsheet_id, gid = target
        credentials = self._load_google_credentials()
        if credentials is None or google_build is None:
            raise RuntimeError(
                "Google Sheets OAuth credentials are required to read the sessions source."
            )

        service = google_build("sheets", "v4", credentials=credentials, cache_discovery=False)
        metadata = service.spreadsheets().get(
            spreadsheetId=spreadsheet_id,
            fields="sheets(properties(sheetId,title))",
        ).execute()

        requested_title = None
        requested_gid = gid
        sheet_titles = []
        for sheet in metadata.get("sheets", []):
            properties = sheet.get("properties", {})
            title = properties.get("title")
            if title:
                sheet_titles.append(title)
            if gid is not None and int(properties.get("sheetId", -1)) == gid:
                requested_title = title

        if not sheet_titles:
            raise ValueError(
                f"No worksheets found for spreadsheet {spreadsheet_id}"
            )

        ordered_titles = []
        for title in [requested_title, *PREFERRED_SESSIONS_SHEET_TITLES, *sheet_titles]:
            if title and title not in ordered_titles:
                ordered_titles.append(title)

        best_title = None
        best_score = -1
        best_df = pd.DataFrame()
        for title in ordered_titles:
            try:
                df = self._sheet_dataframe(service, spreadsheet_id, title)
            except Exception as exc:
                if self._is_unparseable_sheet_range_error(exc):
                    continue
                raise
            score = self._session_schema_score(df)
            if score > best_score:
                best_title = title
                best_score = score
                best_df = df
            if self._is_sessions_dataframe(df):
                self._last_source_info = {
                    "type": "google_sheet",
                    "source_url": self.csv_path,
                    "spreadsheet_id": spreadsheet_id,
                    "requested_gid": requested_gid,
                    "requested_sheet_title": requested_title,
                    "sheet_title": title,
                    "available_sheets": sheet_titles,
                    "columns": [str(col) for col in df.columns],
                    "raw_row_count": int(len(df)),
                    "missing_required_columns": [],
                }
                if title != requested_title:
                    print(f"[Agent 1] Using Google Sheet tab '{title}' for sessions data")
                return df

        missing = sorted(REQUIRED_SESSION_COLUMNS - {str(col).strip() for col in best_df.columns})
        self._last_source_info = {
            "type": "google_sheet",
            "source_url": self.csv_path,
            "spreadsheet_id": spreadsheet_id,
            "requested_gid": requested_gid,
            "requested_sheet_title": requested_title,
            "sheet_title": best_title,
            "available_sheets": sheet_titles,
            "columns": [str(col) for col in best_df.columns],
            "raw_row_count": int(len(best_df)),
            "missing_required_columns": missing,
        }
        available = ", ".join(map(str, best_df.columns[:25]))
        raise ValueError(
            "Could not find a Google Sheets tab with the required sessions schema. "
            f"Best match was '{best_title}' but it is missing: {', '.join(missing)}. "
            f"Available columns: {available}"
        )

    def source_health(self) -> dict:
        try:
            df = self._read_sessions_file()
            missing = sorted(REQUIRED_SESSION_COLUMNS - {str(col).strip() for col in df.columns})
            date_range = {"min": None, "max": None}
            if "Date" in df.columns:
                parsed_dates = parse_google_sheet_dates(df["Date"]).dropna()
                if not parsed_dates.empty:
                    date_range = {
                        "min": parsed_dates.min().strftime("%Y-%m-%d"),
                        "max": parsed_dates.max().strftime("%Y-%m-%d"),
                    }
            return {
                **self._last_source_info,
                "ok": not missing,
                "row_count": int(len(df)),
                "date_range": date_range,
                "missing_required_columns": missing,
            }
        except Exception as exc:
            return {
                **self._last_source_info,
                "ok": False,
                "source_url": self.csv_path,
                "error": str(exc),
            }

    def _read_sessions_file(self) -> pd.DataFrame:
        if not self._source_is_url() or not self._looks_like_google_sheet():
            if Path(self.csv_path).exists():
                return pd.read_csv(self.csv_path)
            raise ValueError(
                "DataIngestor now reads Google Sheets or local CSV files. Provide a valid path or Google Sheet URL."
            )
        oauth_df = self._fetch_google_sheet_dataframe()
        if oauth_df is None:
            raise RuntimeError("Failed to read Google Sheets sessions data.")
        return oauth_df

    def run(self) -> dict:
        print("[Agent 1] Ingestor starting...")
        df = self._read_sessions_file()

        missing_columns = sorted(REQUIRED_SESSION_COLUMNS - {str(col).strip() for col in df.columns})
        if missing_columns:
            raise ValueError(
                "Sessions data is missing required columns: "
                + ", ".join(missing_columns)
            )

        # Parse date
        df["Date"] = parse_google_sheet_dates(df["Date"])
        df = df.dropna(subset=["Date"])
        completed_mask = df["Date"].dt.normalize() < historic_cutoff_date()
        dropped_future = int((~completed_mask).sum())
        df = df.loc[completed_mask].copy()
        if dropped_future:
            print(f"  Excluded {dropped_future:,} non-completed/future session rows")

        # Normalize time to HH:MM
        df["Time"] = df["Time"].apply(normalize_google_sheet_time)

        # Normalize whitespace in text columns (collapse double-spaces, strip)
        for col in ["Trainer", "Class", "Location"]:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()

        # Copper & Cloves is scheduled as a Bengaluru extension using historic
        # Pop-up rows whose class name identifies the Copper partnership.
        session_names = df["SessionName"] if "SessionName" in df.columns else ""
        copper_mask = (
            df["Location"].astype(str).str.lower().eq("pop-up")
            & pd.Series(session_names, index=df.index).astype(str).str.contains("copper", case=False, na=False)
        )
        df.loc[copper_mask, "Location"] = "Copper & Cloves"
        df.loc[copper_mask, "Class"] = df.loc[copper_mask].apply(copper_class_name, axis=1)

        # Filter to valid scheduling locations after derived-location mapping.
        df = df[df["Location"].isin(VALID_LOCATIONS)].copy()

        # Ensure numeric columns
        for col in ["CheckedIn", "Capacity", "Booked", "LateCancelled", "Revenue"]:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # Derived columns
        df["fill_rate"] = np.where(
            df["Capacity"] > 0,
            (df["CheckedIn"] / df["Capacity"]).clip(upper=1.0),
            0.0,
        )
        df["no_show_rate"] = np.where(
            df["Booked"] > 0,
            (df["Booked"] - df["CheckedIn"]) / df["Booked"],
            0.0,
        )
        df["late_cancel_rate"] = np.where(
            df["Booked"] > 0,
            df["LateCancelled"] / df["Booked"],
            0.0,
        )
        df["revenue_per_seat"] = np.where(
            df["CheckedIn"] > 0,
            df["Revenue"] / df["CheckedIn"],
            0.0,
        )
        df["day_of_week"] = df["Date"].dt.dayofweek  # Monday=0
        df["time_band"] = df["Time"].apply(time_band)

        # Drop rows with missing critical fields
        df = df.dropna(subset=["Location", "Class", "Trainer", "Time"])
        if df.empty:
            raise ValueError("Sessions data has no valid rows after parsing dates and required fields.")

        total = len(df)
        date_min = df["Date"].min().strftime("%Y-%m-%d")
        date_max = df["Date"].max().strftime("%Y-%m-%d")

        records = json.loads(df.to_json(orient="records", date_format="iso"))

        output = {
            "locations": VALID_LOCATIONS,
            "total_sessions": total,
            "date_range": {"min": date_min, "max": date_max},
            "source": {
                **self._last_source_info,
                "row_count": total,
                "date_range": {"min": date_min, "max": date_max},
                "missing_required_columns": [],
            },
            "sessions": records,
        }

        STATE_DIR.mkdir(exist_ok=True)
        out_path = STATE_DIR / "01_sessions.json"
        with open(out_path, "w") as f:
            json.dump(output, f, default=str)

        print(
            f"[Agent 1] Ingestor complete — {total:,} sessions across {len(VALID_LOCATIONS)} locations"
        )
        return output
