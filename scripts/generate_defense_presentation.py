#!/usr/bin/env python3
"""Generate the DevPilot AI PFA defense deck as an editable PowerPoint.

The script uses LibreOffice's UNO bridge, which is available in the project
environment, and intentionally draws the deck with native shapes instead of
flattening slides into images.
"""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import time

import uno


FILL_NONE = uno.Enum("com.sun.star.drawing.FillStyle", "NONE")
FILL_SOLID = uno.Enum("com.sun.star.drawing.FillStyle", "SOLID")
LINE_NONE = uno.Enum("com.sun.star.drawing.LineStyle", "NONE")
LINE_SOLID = uno.Enum("com.sun.star.drawing.LineStyle", "SOLID")


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "deliverables" / "DevPilot_AI_PFA_Defense.pptx"
PDF_OUTPUT = ROOT / "deliverables" / "DevPilot_AI_PFA_Defense.pdf"

W = 33867
H = 19050


def rgb(value: str) -> int:
    return int(value.lstrip("#"), 16)


C = {
    "navy": rgb("071A33"),
    "navy2": rgb("0D2445"),
    "panel": rgb("102B50"),
    "panel2": rgb("17375E"),
    "white": rgb("F7FAFC"),
    "text": rgb("DCE8F5"),
    "muted": rgb("8FA8C2"),
    "cyan": rgb("11C5E8"),
    "blue": rgb("3B82F6"),
    "green": rgb("27D49B"),
    "purple": rgb("A78BFA"),
    "amber": rgb("F7B955"),
    "red": rgb("FB7185"),
    "line": rgb("294B70"),
    "ink": rgb("0B1930"),
    "light": rgb("EDF5FC"),
}


def point(x: int, y: int) -> object:
    value = uno.createUnoStruct("com.sun.star.awt.Point")
    value.X = x
    value.Y = y
    return value


def uno_size(w: int, h: int) -> object:
    value = uno.createUnoStruct("com.sun.star.awt.Size")
    value.Width = w
    value.Height = h
    return value


def prop(name: str, value: object) -> object:
    item = uno.createUnoStruct("com.sun.star.beans.PropertyValue")
    item.Name = name
    item.Value = value
    return item


def connect_office() -> tuple[object, subprocess.Popen[bytes] | None]:
    port = 2002
    profile = Path("/tmp/devpilot-lo-profile")
    profile.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["HOME"] = "/tmp"
    cmd = [
        "soffice",
        "--headless",
        "--nologo",
        "--nodefault",
        "--nofirststartwizard",
        f"-env:UserInstallation=file://{profile}",
        f"--accept=socket,host=localhost,port={port};urp;StarOffice.ServiceManager",
    ]
    process: subprocess.Popen[bytes] | None = subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    local_ctx = uno.getComponentContext()
    resolver = local_ctx.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", local_ctx
    )
    deadline = time.time() + 15
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            ctx = resolver.resolve(
                f"uno:socket,host=localhost,port={port};urp;StarOffice.ComponentContext"
            )
            return ctx, process
        except Exception as exc:  # LibreOffice is still starting.
            last_error = exc
            time.sleep(0.25)
    if process is not None:
        process.terminate()
    raise RuntimeError(f"Could not connect to LibreOffice UNO: {last_error}")


class Deck:
    def __init__(self, doc: object, ctx: object) -> None:
        self.doc = doc
        self.ctx = ctx
        self.pages = doc.getDrawPages()
        self.slide_no = 0

    def slide(self, title: str, kicker: str = "") -> object:
        if self.slide_no == 0:
            page = self.pages.getByIndex(0)
        else:
            page = self.pages.insertNewByIndex(self.pages.getCount())
        page.Width = W
        page.Height = H
        self.slide_no += 1
        self.rect(page, 0, 0, W, H, C["navy"], C["navy"], 0)
        self.rect(page, 0, 0, 420, H, C["cyan"], C["cyan"], 0)
        if kicker:
            self.text(page, 1250, 330, 17500, 430, kicker.upper(), 9.5, C["cyan"], bold=True)
        self.text(page, 1250, 760, 29000, 1800, title, 25.5, C["white"], bold=True)
        self.line(page, 1250, 2780, 32600, 2780, C["line"], 40)
        self.text(page, 1250, 17870, 8000, 330, "DEVPILOT AI · ENSIAS · PFA 2025–2026", 7.5, C["muted"])
        self.text(page, 31300, 17820, 900, 400, str(self.slide_no), 9, C["muted"], align=3)
        return page

    def blank(self) -> object:
        if self.slide_no == 0:
            page = self.pages.getByIndex(0)
        else:
            page = self.pages.insertNewByIndex(self.pages.getCount())
        page.Width = W
        page.Height = H
        self.slide_no += 1
        return page

    def rect(
        self,
        slide: object,
        x: int,
        y: int,
        w: int,
        h: int,
        fill: int,
        line: int | None = None,
        radius: int = 260,
        transparency: int = 0,
    ) -> object:
        shape = self.doc.createInstance("com.sun.star.drawing.RectangleShape")
        shape.Position = point(x, y)
        shape.Size = uno_size(w, h)
        shape.FillStyle = FILL_SOLID
        shape.FillColor = fill
        shape.FillTransparence = transparency
        if line is None:
            shape.LineStyle = LINE_NONE
        else:
            shape.LineStyle = LINE_SOLID
            shape.LineColor = line
            shape.LineWidth = 25
        if hasattr(shape, "CornerRadius"):
            shape.CornerRadius = radius
        slide.add(shape)
        return shape

    def ellipse(
        self,
        slide: object,
        x: int,
        y: int,
        w: int,
        h: int,
        fill: int,
        line: int | None = None,
        transparency: int = 0,
    ) -> object:
        shape = self.doc.createInstance("com.sun.star.drawing.EllipseShape")
        shape.Position = point(x, y)
        shape.Size = uno_size(w, h)
        shape.FillStyle = FILL_SOLID
        shape.FillColor = fill
        shape.FillTransparence = transparency
        if line is None:
            shape.LineStyle = LINE_NONE
        else:
            shape.LineStyle = LINE_SOLID
            shape.LineColor = line
            shape.LineWidth = 25
        slide.add(shape)
        return shape

    def text(
        self,
        slide: object,
        x: int,
        y: int,
        w: int,
        h: int,
        value: str,
        size: float = 16,
        color: int = C["text"],
        *,
        bold: bool = False,
        align: int = 0,
        valign: int = 1,
        margin: int = 80,
        font: str = "Liberation Sans",
    ) -> object:
        shape = self.doc.createInstance("com.sun.star.drawing.TextShape")
        shape.Position = point(x, y)
        shape.Size = uno_size(w, h)
        shape.FillStyle = FILL_NONE
        shape.LineStyle = LINE_NONE
        slide.add(shape)
        shape.String = value
        shape.TextLeftDistance = margin
        shape.TextRightDistance = margin
        shape.TextUpperDistance = 40
        shape.TextLowerDistance = 20
        shape.TextAutoGrowHeight = False
        shape.TextAutoGrowWidth = False
        shape.TextVerticalAdjust = valign
        shape.CharFontName = font
        shape.CharHeight = size
        shape.CharColor = color
        shape.CharWeight = 150.0 if bold else 100.0
        shape.ParaAdjust = align
        return shape

    def line(
        self,
        slide: object,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        color: int,
        width: int = 35,
        arrow: bool = False,
        dashed: bool = False,
    ) -> object:
        shape = self.doc.createInstance("com.sun.star.drawing.LineShape")
        shape.Position = point(x1, y1)
        shape.Size = uno_size(x2 - x1, y2 - y1)
        shape.LineStyle = LINE_SOLID
        shape.LineColor = color
        shape.LineWidth = width
        if arrow:
            try:
                shape.LineEndName = "Arrow"
                shape.LineEndWidth = 220
            except Exception:
                pass
        if dashed:
            try:
                shape.LineDashName = "Fine Dashed"
            except Exception:
                pass
        slide.add(shape)
        return shape

    def image(self, slide: object, path: Path, x: int, y: int, w: int, h: int) -> object:
        provider = self.ctx.ServiceManager.createInstanceWithContext(
            "com.sun.star.graphic.GraphicProvider", self.ctx
        )
        graphic = provider.queryGraphic((prop("URL", uno.systemPathToFileUrl(str(path))),))
        shape = self.doc.createInstance("com.sun.star.drawing.GraphicObjectShape")
        shape.Position = point(x, y)
        shape.Size = uno_size(w, h)
        shape.Graphic = graphic
        slide.add(shape)
        return shape

    def pill(self, slide: object, x: int, y: int, w: int, label: str, color: int) -> None:
        self.rect(slide, x, y, w, 620, color, color, 310, 8)
        self.text(slide, x + 80, y + 50, w - 160, 500, label, 10, C["white"], bold=True, align=3)

    def card(
        self,
        slide: object,
        x: int,
        y: int,
        w: int,
        h: int,
        title: str,
        body: str,
        accent: int,
        *,
        tag: str | None = None,
        body_size: float = 13,
    ) -> None:
        self.rect(slide, x, y, w, h, C["panel"], C["line"], 260)
        self.rect(slide, x, y, 110, h, accent, accent, 100)
        if tag:
            self.pill(slide, x + 430, y + 330, min(3400, w - 850), tag, accent)
            title_y = y + 1450
        else:
            title_y = y + 360
        self.text(slide, x + 420, title_y, w - 750, 800, title, 16, C["white"], bold=True)
        self.text(slide, x + 420, title_y + 900, w - 760, h - (title_y - y) - 1200, body, body_size, C["text"], valign=0)

    def stat(self, slide: object, x: int, y: int, w: int, value: str, label: str, accent: int) -> None:
        self.rect(slide, x, y, w, 2600, C["panel"], C["line"], 250)
        self.text(slide, x + 220, y + 300, w - 440, 1100, value, 29, accent, bold=True, align=3)
        self.text(slide, x + 250, y + 1450, w - 500, 700, label, 11.5, C["text"], bold=True, align=3)

    def node(
        self,
        slide: object,
        x: int,
        y: int,
        w: int,
        h: int,
        title: str,
        sub: str,
        accent: int,
        *,
        number: str | None = None,
    ) -> None:
        self.rect(slide, x, y, w, h, C["panel"], accent, 220)
        if number:
            self.ellipse(slide, x + 240, y + 260, 680, 680, accent, accent)
            self.text(slide, x + 240, y + 325, 680, 500, number, 12, C["navy"], bold=True, align=3)
            text_x = x + 1100
            text_w = w - 1340
        else:
            text_x = x + 350
            text_w = w - 700
        title_size = 12.5 if len(title) > 16 else 14
        self.text(slide, text_x, y + 240, text_w, 720, title, title_size, C["white"], bold=True)
        self.text(slide, text_x, y + 1050, text_w, h - 1220, sub, 10.5, C["muted"], valign=0)


def add_cover(deck: Deck, ensias_logo: Path | None, university_logo: Path | None) -> None:
    s = deck.blank()
    deck.rect(s, 0, 0, W, H, C["navy"], C["navy"], 0)
    deck.ellipse(s, 23800, -3600, 15000, 15000, C["cyan"], None, 82)
    deck.ellipse(s, 26500, 8200, 10500, 10500, C["purple"], None, 88)
    deck.rect(s, 0, 0, 430, H, C["cyan"], C["cyan"], 0)
    if ensias_logo and ensias_logo.exists():
        deck.image(s, ensias_logo, 1250, 850, 2250, 2250)
    if university_logo and university_logo.exists():
        deck.image(s, university_logo, 28100, 850, 3900, 2750)
    deck.pill(s, 4250, 2050, 3300, "PFA · 2025–2026", C["blue"])
    deck.text(s, 4200, 3650, 23500, 2100, "DevPilot AI", 43, C["white"], bold=True)
    deck.text(
        s,
        4200,
        6000,
        23700,
        2200,
        "Plateforme agentique de RAG\nobservable, traçable et explicable",
        24,
        C["cyan"],
        bold=True,
        valign=0,
    )
    deck.text(
        s,
        4250,
        8750,
        22500,
        1500,
        "Transformer des documents privés en réponses ancrées, citées et auditables.",
        16,
        C["text"],
        valign=0,
    )
    deck.line(s, 4250, 11000, 27900, 11000, C["line"], 35)
    deck.text(s, 4250, 11700, 6000, 500, "RÉALISÉ PAR", 9, C["muted"], bold=True)
    deck.text(s, 4250, 12400, 8000, 1300, "Bilal Malih\nOussama Mahi", 17, C["white"], bold=True, valign=0)
    deck.text(s, 13700, 11700, 6000, 500, "ENCADRÉ PAR", 9, C["muted"], bold=True)
    deck.text(s, 13700, 12400, 8200, 900, "Pr. Widad ELOUATAOUI", 16, C["white"], bold=True)
    deck.text(s, 4250, 17650, 8000, 400, "ENSIAS · Filière Data and Software Science", 8.5, C["muted"])
    deck.text(s, 26300, 17650, 5800, 400, "19 juin 2026", 8.5, C["muted"], align=3)


def build_deck(
    doc: object,
    ctx: object,
    ensias_logo: Path | None,
    university_logo: Path | None,
) -> Deck:
    d = Deck(doc, ctx)
    add_cover(d, ensias_logo, university_logo)

    # 2 — promise / roadmap
    s = d.slide("Une soutenance, une démonstration, trois preuves", "Fil conducteur")
    d.text(s, 1250, 3300, 30000, 750, "Notre question : peut-on rendre un système RAG aussi inspectable qu’un service logiciel critique ?", 18, C["text"], bold=True)
    d.card(s, 1250, 4700, 9500, 7900, "1 · COMPRENDRE", "Le problème métier\n\nPourquoi la recherche classique et les assistants généralistes ne suffisent pas pour une connaissance privée.", C["cyan"], tag="CONTEXTE")
    d.card(s, 12180, 4700, 9500, 7900, "2 · CONSTRUIRE", "L’architecture réelle\n\nIngestion asynchrone, recherche hybride, pipeline spécialisé, sécurité et streaming.", C["purple"], tag="CONCEPTION")
    d.card(s, 23110, 4700, 9500, 7900, "3 · PROUVER", "La valeur observable\n\nDémonstration, traces, RAGOps, tests versionnés, limites et perspectives.", C["green"], tag="RÉSULTATS")
    d.text(s, 1250, 14200, 30500, 900, "Objectif de la présentation : montrer non seulement la réponse, mais aussi les preuves de sa production.", 16, C["white"], bold=True, align=3)

    # 3 — problem
    s = d.slide("Le problème : la connaissance existe, mais reste difficile à exploiter", "Contexte")
    d.card(s, 1250, 3500, 9300, 9300, "Connaissance fragmentée", "Spécifications\nDocumentation d’architecture\nComptes rendus\nProcédures internes\nDécisions techniques", C["cyan"])
    d.card(s, 12270, 3500, 9300, 9300, "Recherche limitée", "Les mots-clés trouvent des chaînes de caractères, mais comprennent mal l’intention, les synonymes et le contexte.", C["amber"])
    d.card(s, 23290, 3500, 9300, 9300, "Réponse opaque", "Une réponse plausible sans source, sans trace et sans score de qualité est difficile à vérifier et risquée à utiliser.", C["red"])
    d.rect(s, 4100, 14000, 25600, 1700, C["panel2"], C["cyan"], 300)
    d.text(s, 4700, 14300, 24400, 1000, "Question directrice : comment centraliser, retrouver, générer, mesurer et auditer ?", 19, C["white"], bold=True, align=3)

    # 4 — solution pillars
    s = d.slide("Notre réponse : une plateforme RAG conçue autour de la preuve", "Vision")
    d.text(s, 1250, 3300, 30500, 700, "DevPilot AI associe la recherche documentaire à une couche d’exploitation et de gouvernance.", 17, C["text"])
    pillars = [
        ("01", "ANCRER", "Recherche hybride\nContexte privé\nCitations [n]", C["cyan"]),
        ("02", "MESURER", "Fidélité\nPertinence\nRisque d’hallucination", C["green"]),
        ("03", "TRACER", "Étapes\nChunks & scores\nLatences", C["purple"]),
        ("04", "GOUVERNER", "JWT & RBAC\nWorkspaces\nAudit", C["amber"]),
    ]
    for i, (num, title, body, accent) in enumerate(pillars):
        x = 1250 + i * 7900
        d.rect(s, x, 5000, 7000, 7800, C["panel"], C["line"], 260)
        d.ellipse(s, x + 450, 5500, 1150, 1150, accent, accent)
        d.text(s, x + 450, 5770, 1150, 600, num, 13, C["navy"], bold=True, align=3)
        d.text(s, x + 450, 7100, 6000, 800, title, 18, C["white"], bold=True)
        d.text(s, x + 450, 8500, 6000, 2300, body, 14, C["text"], valign=0)
        d.rect(s, x + 450, 11650, 6100, 120, accent, accent, 60)
    d.text(s, 1250, 14250, 30500, 850, "Différenciation : la réponse + les sources + le déroulement + le signal de qualité.", 17, C["cyan"], bold=True, align=3)

    # 5 — scope
    s = d.slide("Périmètre livré", "Objectifs")
    d.text(s, 1250, 3300, 14500, 600, "FONCTIONNEL", 11, C["cyan"], bold=True)
    d.text(s, 17500, 3300, 14500, 600, "NON FONCTIONNEL", 11, C["green"], bold=True)
    left = [
        "Authentification et rôles",
        "Workspaces isolés",
        "Upload PDF / TXT / Markdown",
        "Ingestion asynchrone",
        "Recherche sémantique, lexicale et hybride",
        "Chat cité, évaluation et historique",
        "RAGOps, traces et studio d’exécution",
    ]
    right = [
        "Sécurité : JWT, RBAC, filtres workspace",
        "Réactivité : API async + SSE",
        "Résilience : retries et fallbacks ciblés",
        "Maintenabilité : couches + typage + migrations",
        "Observabilité : logs, métriques, traces",
        "Déploiement : Docker Compose",
        "Transparence : limites documentées",
    ]
    for col, items, x, accent in [(0, left, 1250, C["cyan"]), (1, right, 17500, C["green"])]:
        for i, item in enumerate(items):
            y = 4400 + i * 1650
            d.ellipse(s, x, y + 120, 620, 620, accent, accent)
            d.text(s, x, y + 210, 620, 400, "✓", 12, C["navy"], bold=True, align=3)
            d.text(s, x + 900, y, 13900, 900, item, 14, C["white"], bold=True)
    d.rect(s, 1250, 16400, 30600, 900, C["panel2"], C["line"], 180)
    d.text(s, 1550, 16520, 30000, 600, "Hors périmètre actuel : haute disponibilité, Kubernetes, multi-tenant SaaS et benchmark RAGAS.", 12.5, C["muted"], align=3)

    # 6 — architecture
    s = d.slide("Architecture globale : monolithe modulaire + worker asynchrone", "Conception")
    d.text(s, 1250, 3250, 30500, 650, "8 services Docker Compose · Ollama sur l’hôte · Gemini externe", 14, C["muted"], align=3)
    d.node(s, 1250, 5600, 4400, 2600, "Utilisateur", "Navigateur", C["cyan"])
    d.node(s, 6900, 5600, 5000, 2600, "Next.js 15", "React 19 · UI", C["blue"])
    d.node(s, 13550, 5000, 5500, 3800, "FastAPI", "API REST + SSE\nMonolithe modulaire", C["purple"])
    d.node(s, 20700, 3900, 5000, 2200, "PostgreSQL", "État + traces", C["green"])
    d.node(s, 20700, 6800, 5000, 2200, "Qdrant", "Vecteurs cosine", C["green"])
    d.node(s, 27500, 3900, 4700, 2200, "Redis", "Broker Celery", C["amber"])
    d.node(s, 27500, 6800, 4700, 2200, "Celery worker", "Ingestion", C["amber"])
    d.node(s, 10400, 11200, 5000, 2200, "Ollama · hôte", "Embeddings locaux", C["cyan"])
    d.node(s, 17300, 11200, 5000, 2200, "Gemini · externe", "Génération", C["purple"])
    d.node(s, 25200, 11200, 6200, 2200, "Prometheus → Grafana", "Métriques runtime", C["red"])
    for x1, y1, x2, y2 in [
        (5650, 6900, 6900, 6900), (11900, 6900, 13550, 6900),
        (19050, 5900, 20700, 5000), (19050, 7200, 20700, 7900),
        (19050, 6500, 27500, 5000), (29900, 6100, 29900, 6800),
        (16300, 8800, 12900, 11200), (17400, 8800, 19800, 11200),
        (19050, 8000, 25200, 12300),
    ]:
        d.line(s, x1, y1, x2, y2, C["line"], 45, arrow=True)
    d.text(s, 1250, 15150, 30500, 1000, "Séparation logique forte, sans complexité artificielle de microservices.", 16, C["cyan"], bold=True, align=3)

    # 7 — ingestion
    s = d.slide("Ingestion documentaire asynchrone", "Implémentation")
    d.text(s, 1250, 3250, 30500, 700, "La requête HTTP reste rapide ; le traitement lourd est délégué au worker.", 15, C["text"], align=3)
    stages = [
        ("1", "UPLOAD", "PDF · TXT · MD\n≤ 10 MiB", C["cyan"]),
        ("2", "EXTRACTION", "pypdf / UTF-8", C["blue"]),
        ("3", "NETTOYAGE", "Prose + code fences", C["purple"]),
        ("4", "CHUNKING", "800 tokens\n150 overlap", C["amber"]),
        ("5", "EMBEDDING", "nomic-embed-text\n768 dimensions", C["green"]),
        ("6", "INDEXATION", "Qdrant cosine", C["cyan"]),
    ]
    for i, (num, title, body, accent) in enumerate(stages):
        x = 900 + i * 5450
        d.node(s, x, 6100, 4500, 4000, title, body, accent, number=num)
        if i < len(stages) - 1:
            d.line(s, x + 4500, 8100, x + 5350, 8100, C["line"], 45, arrow=True)
    d.rect(s, 2400, 11900, 29000, 2500, C["panel"], C["line"], 240)
    d.text(s, 2900, 12300, 6200, 500, "CYCLE DE STATUT", 10, C["muted"], bold=True)
    d.text(s, 2900, 13200, 25000, 700, "queued  →  processing  →  indexed", 20, C["green"], bold=True)
    d.text(s, 24600, 13070, 6200, 800, "failed\n(retry contrôlé)", 13, C["red"], bold=True, align=3, valign=0)
    d.pill(s, 9700, 15100, 4300, "Celery + Redis", C["amber"])
    d.pill(s, 14500, 15100, 4700, "Batch embeddings = 4", C["green"])
    d.pill(s, 19700, 15100, 4400, "Isolation workspace", C["cyan"])

    # 8 — retrieval
    s = d.slide("Recherche hybride : rappel d’abord, précision ensuite", "RAG")
    d.node(s, 1250, 7100, 4600, 2800, "Question", "Requête normalisée", C["white"])
    d.node(s, 7600, 4700, 7000, 3300, "Recherche sémantique", "Embedding Ollama\nQdrant · cosine", C["cyan"])
    d.node(s, 7600, 9400, 7000, 3300, "Recherche lexicale", "PostgreSQL FTS\n+ fallback overlap", C["amber"])
    d.node(s, 16900, 7100, 5600, 3100, "Fusion RRF", "k = 60\n15 candidats", C["purple"])
    d.node(s, 24700, 7100, 6800, 3100, "Reranking", "Heuristique par défaut\nOllama optionnel\nTop 5", C["green"])
    d.line(s, 5850, 8200, 7600, 6300, C["line"], 45, arrow=True)
    d.line(s, 5850, 8800, 7600, 10800, C["line"], 45, arrow=True)
    d.line(s, 14600, 6300, 16900, 8200, C["line"], 45, arrow=True)
    d.line(s, 14600, 10800, 16900, 9000, C["line"], 45, arrow=True)
    d.line(s, 22500, 8600, 24700, 8600, C["line"], 45, arrow=True)
    d.rect(s, 4900, 13900, 25300, 1800, C["panel2"], C["line"], 220)
    d.text(s, 5400, 14230, 24300, 1000, "Hybrid = Qdrant sémantique + PostgreSQL lexical · filtrés par workspace · fusionnés par rang.", 15, C["white"], bold=True, align=3)

    # 9 — agent pipeline
    s = d.slide("Pipeline spécialisé en 7 rôles", "Orchestration agentique")
    d.text(s, 1250, 3250, 30500, 650, "Les rôles sont orchestrés séquentiellement ; tous ne sont pas des agents LLM autonomes.", 15, C["text"], align=3)
    agents = [
        ("1", "Router", "Classe la requête", C["cyan"], "RÈGLES"),
        ("2", "Rewriter", "Normalise la recherche", C["cyan"], "RÈGLES"),
        ("3", "Retrieval", "Récupère 15 candidats", C["blue"], "SERVICE"),
        ("4", "Reranker", "Sélectionne top 5", C["amber"], "HEURISTIQUE"),
        ("5", "Generator", "Produit la réponse", C["purple"], "LLM"),
        ("6", "Evaluator", "Calcule 4 scores", C["green"], "LLM / HEUR."),
        ("7", "Corrector", "Garde, extrait ou refuse", C["red"], "RÈGLES"),
    ]
    for i, (num, title, body, accent, tag) in enumerate(agents):
        x = 650 + i * 4700
        d.rect(s, x, 5900, 4100, 6000, C["panel"], accent, 240)
        d.ellipse(s, x + 1450, 5300, 1200, 1200, accent, accent)
        d.text(s, x + 1450, 5580, 1200, 600, num, 13, C["navy"], bold=True, align=3)
        d.pill(s, x + 500, 6900, 3100, tag, accent)
        d.text(s, x + 350, 8100, 3400, 700, title, 16, C["white"], bold=True, align=3)
        d.text(s, x + 350, 9300, 3400, 1300, body, 12, C["text"], align=3, valign=0)
        if i < len(agents) - 1:
            d.line(s, x + 4100, 8900, x + 4550, 8900, C["line"], 40, arrow=True)
    d.rect(s, 5400, 13400, 23000, 2200, C["panel2"], C["green"], 260)
    d.text(s, 6000, 13850, 21800, 1100, "Sortie : réponse finale ancrée + citations + évaluation + trace persistée", 17, C["white"], bold=True, align=3)

    # 10 — streaming + lineage
    s = d.slide("Streaming et traçabilité : chaque réponse laisse une preuve", "SSE + PostgreSQL")
    events = [
        ("start", C["cyan"]), ("rewrite", C["cyan"]), ("retrieval", C["blue"]),
        ("rerank", C["amber"]), ("tokens", C["purple"]),
        ("evaluate", C["green"]), ("correct ?", C["red"]),
        ("citations", C["cyan"]), ("message", C["white"]), ("done", C["green"]),
    ]
    x0 = 1200
    for i, (label, accent) in enumerate(events):
        x = x0 + i * 3170
        d.ellipse(s, x, 5050, 760, 760, accent, accent)
        d.text(s, x - 450, 6100, 1700, 700, label, 10, C["text"], bold=True, align=3)
        if i < len(events) - 1:
            d.line(s, x + 760, 5430, x + 3000, 5430, C["line"], 35, arrow=True)
    d.text(s, 1250, 7800, 30500, 650, "L’assistant message devient l’ancre de la lignée d’exécution", 16, C["white"], bold=True, align=3)
    d.node(s, 12400, 9100, 9000, 2600, "messages", "Question + réponse finale", C["white"])
    lineage = [
        (1800, 13000, "agent_runs", "rôle · statut · latence · I/O", C["purple"]),
        (9500, 13000, "retrieved_chunks", "rang · score · stratégie", C["cyan"]),
        (18100, 13000, "evaluations", "fidélité · pertinence · risque", C["green"]),
        (26700, 13000, "llm_usage", "modèle · tokens · latence", C["amber"]),
    ]
    for x, y, title, sub, accent in lineage:
        d.node(s, x, y, 5900, 2300, title, sub, accent)
        d.line(s, 16900, 11700, x + 2950, y, C["line"], 35, arrow=True)

    # 11 — security
    s = d.slide("Sécurité et gouvernance intégrées", "Confiance")
    d.text(s, 1250, 3300, 30500, 700, "La sécurité est appliquée à la route, à la base relationnelle et à la recherche vectorielle.", 15, C["text"], align=3)
    d.card(s, 1250, 4900, 7200, 8300, "IDENTITÉ", "JWT signé\nMot de passe bcrypt\nUtilisateur actif\nSession côté client", C["cyan"])
    d.card(s, 9250, 4900, 7200, 8300, "AUTORISATION", "Rôles user / admin / super-admin\nDépendances FastAPI\nPermissions propriétaire", C["purple"])
    d.card(s, 17250, 4900, 7200, 8300, "ISOLATION", "Workspace membership\nFiltre PostgreSQL\nPayload filter Qdrant", C["green"])
    d.card(s, 25250, 4900, 7200, 8300, "AUDIT", "Actions administratives\nActeur + cible + raison\nIP + user-agent", C["amber"])
    d.rect(s, 4900, 14500, 25300, 1400, C["panel2"], C["line"], 240)
    d.text(s, 5400, 14740, 24300, 850, "Principe : une requête n’accède jamais à un workspace par simple connaissance de son identifiant.", 14, C["white"], bold=True, align=3)

    # 12 — RAGOps
    s = d.slide("RAGOps : observer le système logiciel et la qualité RAG", "Observabilité")
    d.card(s, 1250, 4200, 9500, 8700, "RUNTIME", "Prometheus + Grafana\n\n• débit HTTP\n• latence p95\n• requêtes RAG\n• tokens LLM\n• ingestion", C["red"], tag="MÉTRIQUES")
    d.card(s, 12180, 4200, 9500, 8700, "QUALITÉ", "PostgreSQL + traces\n\n• fidélité\n• pertinence\n• précision contexte\n• hallucination\n• latence agents", C["purple"], tag="ÉVALUATIONS")
    d.card(s, 23110, 4200, 9500, 8700, "OPÉRATIONS", "Control Tower\n\n• couverture embeddings\n• santé workspaces\n• cohérence Qdrant\n• échecs ingestion\n• retry contrôlé", C["green"], tag="RAGOPS")
    d.rect(s, 3000, 14200, 27800, 1750, C["panel2"], C["cyan"], 250)
    d.text(s, 3500, 14500, 26800, 1000, "Score santé = 40% couverture + 20% documents + 20% fidélité + 10% faible hallucination + 10% retrieval", 14, C["white"], bold=True, align=3)

    # 13 — demo
    s = d.slide("Démonstration : de la source à la preuve en 4 minutes", "Live demo")
    d.text(s, 1250, 3250, 30500, 700, "Scénario conseillé : utiliser un document technique court et une question dont la réponse est clairement localisable.", 14, C["text"], align=3)
    demo = [
        ("01", "PRÉPARER", "Choisir un workspace\nUploader un PDF/TXT\nAttendre : indexed", C["cyan"]),
        ("02", "INTERROGER", "Poser une question\nObserver les tokens SSE\nOuvrir les citations", C["purple"]),
        ("03", "EXPLIQUER", "Ouvrir AI Execution Studio\nMontrer retrieval + rerank\nLire les 4 scores", C["green"]),
        ("04", "AUDITER", "Ouvrir Trace Inspector\nMontrer agents + chunks\nFinir dans RAGOps", C["amber"]),
    ]
    for i, (num, title, body, accent) in enumerate(demo):
        x = 1250 + i * 7900
        d.rect(s, x, 5200, 7000, 7600, C["panel"], C["line"], 260)
        d.ellipse(s, x + 2600, 4550, 1800, 1800, accent, accent)
        d.text(s, x + 2600, 5000, 1800, 700, num, 18, C["navy"], bold=True, align=3)
        d.text(s, x + 500, 7100, 6000, 700, title, 17, C["white"], bold=True, align=3)
        d.text(s, x + 700, 8500, 5600, 2300, body, 13, C["text"], align=3, valign=0)
    d.rect(s, 3100, 14300, 27500, 1700, C["panel2"], C["red"], 250)
    d.text(s, 3700, 14590, 26300, 1000, "Plan B soutenance : garder trois captures locales — Chat cité · Trace Inspector · RAGOps Control Tower.", 14, C["white"], bold=True, align=3)

    # 14 — results
    s = d.slide("Résultats : une chaîne fonctionnelle et vérifiable", "Preuves d’ingénierie")
    d.stat(s, 1250, 3900, 9000, "118", "cas de test backend versionnés", C["cyan"])
    d.stat(s, 12400, 3900, 9000, "39", "cas de test frontend versionnés", C["purple"])
    d.stat(s, 23550, 3900, 9000, "36", "scénarios d’intégration live versionnés", C["green"])
    d.text(s, 1250, 7250, 30500, 550, "CAPACITÉS DÉMONTRABLES", 10, C["muted"], bold=True)
    evidence = [
        ("Ingestion", "fichier → chunks → vecteurs", C["cyan"]),
        ("Retrieval", "semantic + keyword + RRF", C["blue"]),
        ("Réponse", "streaming + citations", C["purple"]),
        ("Qualité", "4 scores + correcteur", C["green"]),
        ("Trace", "agents + chunks + usage", C["amber"]),
        ("Ops", "RAGOps + Prometheus/Grafana", C["red"]),
    ]
    for i, (title, body, accent) in enumerate(evidence):
        row = i // 3
        col = i % 3
        x = 1250 + col * 10500
        y = 8500 + row * 3300
        d.node(s, x, y, 9400, 2500, title, body, accent)
    d.text(s, 1250, 15800, 30500, 700, "À joindre au dossier final : capture d’un run pytest/Vitest et mesures de la démonstration réelle.", 12, C["muted"], align=3)

    # 15 — limits
    s = d.slide("Limites assumées et perspectives", "Maturité")
    d.text(s, 1250, 3300, 14500, 600, "AUJOURD’HUI", 11, C["red"], bold=True)
    d.text(s, 17500, 3300, 14500, 600, "PROCHAINE ÉTAPE", 11, C["green"], bold=True)
    now = [
        "Docker Compose mono-hôte",
        "Stockage fichiers local",
        "Évaluation proxy / LLM judge",
        "Reranking heuristique par défaut",
        "Pas de benchmark RAGAS",
        "Pas de tests E2E navigateur automatisés",
    ]
    future = [
        "Kubernetes et stockage objet",
        "Routage multi-LLM dynamique",
        "Cross-encoder de reranking",
        "Jeu d’évaluation + RAGAS",
        "Support multimodal",
        "Alertes et SLO RAG",
    ]
    for x, items, accent in [(1250, now, C["red"]), (17500, future, C["green"])]:
        for i, item in enumerate(items):
            y = 4600 + i * 1800
            d.rect(s, x, y, 14500, 1250, C["panel"], C["line"], 180)
            d.rect(s, x, y, 120, 1250, accent, accent, 50)
            d.text(s, x + 500, y + 180, 13400, 700, item, 14, C["white"], bold=True)
    d.rect(s, 4800, 15800, 24400, 1000, C["panel2"], C["line"], 220)
    d.text(s, 5300, 15960, 23400, 650, "Une limite clairement mesurée devient une feuille de route, pas une faiblesse cachée.", 13.5, C["text"], bold=True, align=3)

    # 16 — conclusion
    s = d.blank()
    d.rect(s, 0, 0, W, H, C["navy"], C["navy"], 0)
    d.ellipse(s, -4500, -3800, 14500, 14500, C["cyan"], None, 88)
    d.ellipse(s, 27000, 11000, 11000, 11000, C["purple"], None, 88)
    d.text(s, 2400, 1800, 28000, 900, "CONCLUSION", 11, C["cyan"], bold=True, align=3)
    d.text(s, 2600, 3350, 27800, 1600, "DevPilot AI rend le RAG inspectable", 31, C["white"], bold=True, align=3)
    d.text(s, 4200, 5600, 24600, 1100, "Pas seulement une réponse — une réponse accompagnée de ses preuves.", 18, C["text"], align=3)
    conclusions = [
        ("ANCRÉ", "Documents privés\nRecherche hybride", C["cyan"]),
        ("AUDITABLE", "Citations\nTrace complète", C["purple"]),
        ("OPÉRABLE", "Évaluation\nRAGOps", C["green"]),
    ]
    for i, (title, body, accent) in enumerate(conclusions):
        x = 3700 + i * 9000
        d.rect(s, x, 8200, 7600, 4300, C["panel"], accent, 300)
        d.text(s, x + 400, 8750, 6800, 700, title, 18, accent, bold=True, align=3)
        d.text(s, x + 500, 10000, 6600, 1400, body, 14, C["white"], bold=True, align=3, valign=0)
    d.text(s, 2400, 14200, 29000, 1000, "Merci pour votre attention", 24, C["white"], bold=True, align=3)
    d.pill(s, 13500, 15800, 6800, "Questions & discussion", C["blue"])
    d.text(s, 2200, 18100, 5000, 300, "DevPilot AI · PFA ENSIAS", 8, C["muted"])
    d.text(s, 27200, 18100, 4500, 300, "Bilal Malih · Oussama Mahi", 8, C["muted"], align=3)

    # 17 — appendix data model
    s = d.slide("Annexe · Modèle de données de traçabilité", "Backup")
    d.text(s, 1250, 3250, 30500, 650, "11 tables métier : identité, knowledge base, conversation, preuves et gouvernance.", 14, C["text"], align=3)
    d.node(s, 1200, 4700, 5200, 2200, "users", "rôle · activité", C["cyan"])
    d.node(s, 8500, 4700, 5200, 2200, "workspaces", "owner · members", C["cyan"])
    d.node(s, 15800, 4700, 5200, 2200, "documents", "status · storage", C["blue"])
    d.node(s, 23100, 4700, 5200, 2200, "chunks", "content · vector_id", C["blue"])
    d.node(s, 1200, 9000, 5200, 2200, "conversations", "user · workspace", C["purple"])
    d.node(s, 8500, 9000, 5200, 2200, "messages", "question · réponse", C["white"])
    d.node(s, 15800, 8200, 5200, 2200, "agent_runs", "status · latence · I/O", C["purple"])
    d.node(s, 23100, 8200, 5200, 2200, "retrieved_chunks", "rang · score", C["cyan"])
    d.node(s, 15800, 11900, 5200, 2200, "evaluations", "4 scores", C["green"])
    d.node(s, 23100, 11900, 5200, 2200, "llm_usage", "modèle · tokens", C["amber"])
    d.node(s, 1200, 13400, 5200, 2200, "audit_logs", "acteur · action · raison", C["red"])
    for x1, y1, x2, y2 in [
        (6400, 5800, 8500, 5800), (13700, 5800, 15800, 5800), (21000, 5800, 23100, 5800),
        (6400, 10100, 8500, 10100), (13700, 10100, 15800, 9300),
        (13700, 10100, 23100, 9300), (13700, 10100, 15800, 13000), (13700, 10100, 23100, 13000),
    ]:
        d.line(s, x1, y1, x2, y2, C["line"], 35, arrow=True)

    # 18 — appendix real parameters
    s = d.slide("Annexe · Paramètres réels du pipeline", "Backup")
    params = [
        ("CHUNK", "800", "tokens", C["cyan"]),
        ("OVERLAP", "150", "tokens", C["cyan"]),
        ("EMBEDDING", "768", "dimensions", C["green"]),
        ("CANDIDATS", "15", "retrieval", C["blue"]),
        ("CONTEXTE", "5", "chunks", C["purple"]),
        ("RRF", "60", "constante k", C["amber"]),
        ("PROMPT", "6000", "caractères max", C["red"]),
        ("UPLOAD", "10", "MiB max", C["white"]),
    ]
    for i, (label, value, unit, accent) in enumerate(params):
        row = i // 4
        col = i % 4
        x = 1250 + col * 7900
        y = 4200 + row * 5200
        d.rect(s, x, y, 7000, 4300, C["panel"], C["line"], 260)
        d.text(s, x + 400, y + 450, 6200, 500, label, 10, C["muted"], bold=True, align=3)
        d.text(s, x + 350, y + 1250, 6300, 1200, value, 31, accent, bold=True, align=3)
        d.text(s, x + 400, y + 2850, 6200, 650, unit, 12, C["white"], bold=True, align=3)
    d.rect(s, 2600, 15100, 28600, 1300, C["panel2"], C["line"], 220)
    d.text(s, 3100, 15340, 27600, 750, "Les valeurs sont configurables ; celles-ci correspondent aux valeurs par défaut du dépôt vérifié.", 13, C["text"], align=3)

    return d


def main() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    ctx, process = connect_office()
    smgr = ctx.ServiceManager
    desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    doc = desktop.loadComponentFromURL("private:factory/simpress", "_blank", 0, ())

    ensias = Path("/tmp/devpilot_pdf_images/cover-000.png")
    university = Path("/tmp/devpilot_pdf_images/cover-002.png")
    build_deck(
        doc,
        ctx,
        ensias if ensias.exists() else None,
        university if university.exists() else None,
    )

    doc.getDocumentProperties().Title = "DevPilot AI — Soutenance PFA"
    doc.getDocumentProperties().Subject = "Plateforme agentique RAG observable et traçable"
    doc.getDocumentProperties().Author = "Bilal Malih & Oussama Mahi"
    doc.getDocumentProperties().Description = (
        "Présentation de soutenance générée à partir de l’implémentation vérifiée du dépôt."
    )

    out_url = uno.systemPathToFileUrl(str(OUTPUT))
    doc.storeAsURL(out_url, (prop("FilterName", "Impress MS PowerPoint 2007 XML"),))
    pdf_url = uno.systemPathToFileUrl(str(PDF_OUTPUT))
    doc.storeToURL(pdf_url, (prop("FilterName", "impress_pdf_Export"),))
    doc.close(True)
    if process is not None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
    print(OUTPUT)
    print(PDF_OUTPUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
