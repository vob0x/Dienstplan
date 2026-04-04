# Dienstplan V6 – Schichtplanung für Teams

Moderne Dienstplan-App mit React, Supabase und Realtime-Sync. Nachfolger der Single-File PWA V5.

## Features

- **4 Kalenderansichten**: Monat, Woche, Tag, Jahr
- **6+ Diensttypen**: Arbeit, Ferien, Pikett, Daagesdubel, Krankheit, Militär (erweiterbar)
- **Paint Mode**: Schnelles Eintragen durch Klicken/Ziehen
- **Team-Sync**: Echtzeit-Synchronisation über Supabase Realtime
- **Rollen-System**: Admin, Planer, Mitglied (flexibel zuweisbar)
- **Genehmigungs-Workflow**: Ferien/Krankheit benötigen Admin-Genehmigung
- **Schicht-Tausch**: Anfrage → Annahme → Genehmigung
- **Pseudonyme Auth**: Anmeldung mit Codename + Passwort (keine E-Mails/Klarnamen)
- **Shared Auth**: Gleiche Supabase-Instanz wie die Zeiterfassung-App
- **i18n**: Deutsch / Français
- **Themes**: Kingsman Cyberpunk (Dark) + Light
- **Jahresstatistik**: Dienst-Auswertung pro Mitarbeiter
- **Keyboard Shortcuts**: Pfeiltasten, M/W/D/J, T, P, 1-9, Ctrl+Z/Y
- **Undo/Redo**: 20-stufiger Verlauf
- **Feiertage**: Schweizer Feiertage inkl. Ostern-basierte
- **PWA**: Installierbar auf Desktop und Mobile
- **Offline-First**: localStorage-Fallback wenn Supabase nicht erreichbar

## Tech Stack

| Schicht | Technologie |
|---------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + CSS Custom Properties |
| State | Zustand (persistiert in localStorage) |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| Icons | Lucide React |
| Dates | date-fns |
| CI/CD | GitHub Actions → GitHub Pages |

## Schnellstart

### 1. Repository klonen

```bash
git clone https://github.com/DEIN-USERNAME/dienstplan-app.git
cd dienstplan-app
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Supabase einrichten

Die App nutzt die **gleiche Supabase-Instanz** wie die Zeiterfassung-App (shared Auth + Teams).

1. SQL Editor öffnen und `supabase/migrations/20260403000000_dienstplan.sql` ausführen
2. Die bestehenden Tabellen `profiles`, `teams`, `team_members` werden referenziert
3. Neue Tabellen: `dp_members`, `dp_duties`, `dp_categories`, `dp_roles`, `dp_shift_swaps`, `dp_approvals`, `dp_user_settings`

### 4. Umgebungsvariablen

```bash
cp .env.example .env
```

`.env` bearbeiten – gleiche Werte wie Zeiterfassung:
```
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

### 5. Entwicklungsserver

```bash
npm run dev
```

Die App läuft auf `http://localhost:5174`

## Supabase-Schema

| Tabelle | Beschreibung |
|---------|-------------|
| `dp_members` | Mitarbeiter pro Team (Name, Sortierung) |
| `dp_categories` | Diensttypen mit Farbe, Buchstabe, Genehmigungspflicht |
| `dp_duties` | Dienst-Einträge (Member × Datum × Kategorie + Notiz) |
| `dp_roles` | Rollen im Team (admin/planner/member) |
| `dp_shift_swaps` | Schicht-Tausch-Anfragen mit Status-Flow |
| `dp_approvals` | Genehmigungs-Anfragen für Abwesenheiten |
| `dp_user_settings` | Theme, Sprache, Default-Ansicht |

Alle Tabellen sind mit Row Level Security (RLS) geschützt. Team-Mitglieder können alle Daten ihres Teams lesen; Schreibzugriff auf Rollen nur für Admins.

## Projektstruktur

```
dienstplan-app/
├── .github/workflows/     # CI/CD Pipeline
├── public/                # PWA manifest
├── supabase/migrations/   # PostgreSQL Schema
├── src/
│   ├── components/
│   │   ├── Auth/          # Login Screen
│   │   ├── Calendar/      # MonthView, WeekView, DayView, YearView, DutyPicker, CalendarNav
│   │   ├── Team/          # TeamView (Rollen, Schicht-Tausch, Genehmigungen)
│   │   ├── Manage/        # Mitarbeiter- & Diensttyp-Verwaltung
│   │   ├── Stats/         # Jahresstatistik
│   │   └── UI/            # Modal, Toast, ConfirmDialog
│   ├── stores/            # Zustand Stores (auth, duty, team, ui)
│   ├── hooks/             # useKeyboardShortcuts
│   ├── i18n/              # DE/FR Übersetzungen
│   ├── lib/               # Supabase Client, Holidays, Utils
│   └── styles/            # Global CSS + Tailwind
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## GitHub Pages Deployment

1. Repository Settings → Pages → Source: "GitHub Actions"
2. Secrets anlegen: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Push auf `main` → automatischer Deploy

## Befehle

```bash
npm run dev       # Entwicklungsserver (Port 5174)
npm run build     # Production-Build
npm run preview   # Production-Preview
```
