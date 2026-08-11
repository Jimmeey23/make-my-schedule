"""Professional, branded PDF rendering for the weekly schedule report.

Replaces the old hand-rolled byte-level PDF writer (finalise_schedule.py's
former _make_pdf) and the client-side window.print() "Export > PDF" hack with
one shared, properly styled renderer built on reportlab (pure Python, no
system libraries required — unlike HTML/CSS-to-PDF tools such as WeasyPrint,
which need Cairo/Pango installed on the host).

Colors below mirror the app's own design tokens in web/app.css so the PDF
reads as the same product, not a generic export.
"""

from datetime import datetime
from io import BytesIO
from typing import Any, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ---- brand palette (mirrors web/app.css :root tokens) ----------------------
COLOR_PRIMARY = colors.HexColor("#1E40AF")
COLOR_PRIMARY_LIGHT = colors.HexColor("#EFF6FF")
COLOR_TEXT = colors.HexColor("#111827")
COLOR_TEXT_MUTED = colors.HexColor("#6B7280")
COLOR_BORDER = colors.HexColor("#E5E7EB")
COLOR_SURFACE = colors.HexColor("#F9FAFB")
COLOR_GREEN = colors.HexColor("#15803D")
COLOR_AMBER = colors.HexColor("#D97706")
COLOR_RED = colors.HexColor("#DC2626")
COLOR_WHITE = colors.white

_STYLES = getSampleStyleSheet()
_STYLE_TITLE = ParagraphStyle(
    "ReportTitle", parent=_STYLES["Title"], fontName="Helvetica-Bold",
    fontSize=20, textColor=COLOR_PRIMARY, spaceAfter=2, alignment=TA_LEFT,
)
_STYLE_SUBTITLE = ParagraphStyle(
    "ReportSubtitle", parent=_STYLES["Normal"], fontName="Helvetica",
    fontSize=11, textColor=COLOR_TEXT_MUTED, spaceAfter=0,
)
_STYLE_SECTION = ParagraphStyle(
    "SectionHeading", parent=_STYLES["Heading2"], fontName="Helvetica-Bold",
    fontSize=13, textColor=COLOR_WHITE, spaceAfter=0, spaceBefore=0,
    leftIndent=0, backColor=COLOR_PRIMARY,
)
_STYLE_KPI_LABEL = ParagraphStyle(
    "KpiLabel", parent=_STYLES["Normal"], fontName="Helvetica", fontSize=8.5,
    textColor=COLOR_TEXT_MUTED, alignment=TA_CENTER,
)
_STYLE_KPI_VALUE = ParagraphStyle(
    "KpiValue", parent=_STYLES["Normal"], fontName="Helvetica-Bold", fontSize=17,
    textColor=COLOR_PRIMARY, alignment=TA_CENTER, spaceBefore=1,
)
_STYLE_CELL = ParagraphStyle(
    "Cell", parent=_STYLES["Normal"], fontName="Helvetica", fontSize=8.3,
    textColor=COLOR_TEXT, leading=10.5,
)
_STYLE_CELL_MUTED = ParagraphStyle(
    "CellMuted", parent=_STYLES["Normal"], fontName="Helvetica", fontSize=8.3,
    textColor=COLOR_TEXT_MUTED, leading=10.5,
)


def _fill_color_hex(fill: Optional[float]) -> str:
    if not isinstance(fill, (int, float)):
        return "#6B7280"
    if fill >= 0.6:
        return "#15803D"
    if fill >= 0.4:
        return "#D97706"
    return "#DC2626"


def _fmt_fill(fill: Any) -> str:
    return f"{float(fill) * 100:.0f}%" if isinstance(fill, (int, float)) else "—"


def _fmt_avg(avg: Any) -> str:
    return f"{float(avg):.1f}" if isinstance(avg, (int, float)) else "—"


def _kpi_block(label: str, value: str) -> Table:
    t = Table(
        [[Paragraph(value, _STYLE_KPI_VALUE)], [Paragraph(label, _STYLE_KPI_LABEL)]],
        colWidths=[42 * mm],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
        ("TOPPADDING", (0, -1), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
    ]))
    return t


def _location_table(location: str, rows: list) -> list:
    story: list = [Paragraph(f"&nbsp;&nbsp;{location}", _STYLE_SECTION), Spacer(1, 6)]
    header = ["Day / Date", "Time", "Class", "Trainer", "Room", "Fill", "Avg"]
    data = [header]
    row_styles = []
    if not rows:
        story.append(Paragraph("No classes scheduled.", _STYLE_CELL_MUTED))
        story.append(Spacer(1, 10))
        return story
    for r in sorted(rows, key=lambda s: (s.get("date", ""), s.get("time", ""), s.get("class_name", ""))):
        fill = r.get("predicted_fill_rate")
        avg = r.get("historical_avg_checkin")
        data.append([
            Paragraph(f"{r.get('day_of_week','')}<br/><font color='#6B7280' size=7>{r.get('date','')}</font>", _STYLE_CELL),
            Paragraph(r.get("time", ""), _STYLE_CELL),
            Paragraph(r.get("class_name", ""), _STYLE_CELL),
            Paragraph(r.get("trainer_1", "") or "—", _STYLE_CELL),
            Paragraph(r.get("room", "") or "—", _STYLE_CELL_MUTED),
            Paragraph(f"<font color='{_fill_color_hex(fill)}'><b>{_fmt_fill(fill)}</b></font>", _STYLE_CELL),
            Paragraph(_fmt_avg(avg), _STYLE_CELL_MUTED),
        ])
    table = Table(data, colWidths=[28 * mm, 15 * mm, 48 * mm, 38 * mm, 20 * mm, 14 * mm, 12 * mm], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), COLOR_WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), COLOR_SURFACE))
    table.setStyle(TableStyle(style))
    story.append(table)
    story.append(Spacer(1, 14))
    return story


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(COLOR_BORDER)
    canvas.line(18 * mm, 14 * mm, doc.pagesize[0] - 18 * mm, 14 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(COLOR_TEXT_MUTED)
    canvas.drawString(18 * mm, 9 * mm, "Physique 57 India — Weekly Schedule Report")
    canvas.drawRightString(doc.pagesize[0] - 18 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_schedule_report_pdf(schedule_data: dict, week_label: str) -> bytes:
    """Render the finalised/exported weekly schedule as a styled, branded PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        topMargin=16 * mm, bottomMargin=20 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
        title=f"Physique 57 India Schedule — {week_label}",
    )
    by_location: dict = schedule_data.get("locations") or {}
    total_classes = sum(len(rows or []) for rows in by_location.values())
    generated = datetime.now().strftime("%d %b %Y")

    story: list = [
        Paragraph("Physique 57 India", _STYLE_TITLE),
        Paragraph(f"Weekly Schedule Report &nbsp;·&nbsp; {week_label}", _STYLE_SUBTITLE),
        Spacer(1, 14),
    ]

    kpi_row = [
        _kpi_block("Total Classes", str(total_classes)),
        _kpi_block("Locations", str(len(by_location))),
        _kpi_block("Generated", generated),
    ]
    kpi_table = Table([kpi_row], colWidths=[44 * mm] * 3, hAlign="LEFT")
    kpi_table.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 6)]))
    story.append(kpi_table)
    story.append(Spacer(1, 18))

    for location in sorted(by_location):
        story.extend(_location_table(location, by_location.get(location) or []))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()


def build_schedule_report_pdf_from_slots(slots: list, week_label: str) -> bytes:
    """Same styled renderer as build_schedule_report_pdf, for callers (e.g. the
    "Export > PDF" UI action) that hold a flat, already-filtered slot list
    rather than the full {"locations": {...}} schedule document."""
    by_location: dict = {}
    for slot in slots or []:
        loc = slot.get("location") or "Unknown"
        by_location.setdefault(loc, []).append(slot)
    return build_schedule_report_pdf({"locations": by_location}, week_label)
