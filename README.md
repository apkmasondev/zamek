# Zamek Tajemnic Rzeczywistości

Interaktywna podróż 3D po zamku-muzeum nad górskim jeziorem. Dziesięć komnat opowiada o tym, jak działa świat: światło, czas, grawitacja, ruch, energia, elektryczność, magnetyzm, materia, życie oraz informacja i sztuczna inteligencja.

**Zwiedzaj:** https://apkmason.dev/zamek/

Wersja 2.1 — zmiany opisuje [CHANGELOG.md](CHANGELOG.md). Poprzednią wersję (1.0) można pobrać z zakładki [Releases](https://github.com/apkmasondev/zamek/releases/tag/v1.0).

## Co znajdziesz w środku

- **Prowadzony spacer:** plac przedbramny → kamienny most → Wielka Sala → komnaty 01–10 → Obserwatorium → taras → belweder → powrót na plac. Po drodze można odpocząć na Dziedzińcu Harmonii.
- **W każdej komnacie:** przestrzenny artefakt, film ilustracyjny, karta z opisem, interaktywne doświadczenie z suwakiem oraz źródła.
- **Tryb filmu:** „Obejrzyj film” na karcie albo kliknięcie ekranu w komnacie — sala przygasa jak w kinie, a film wypełnia widok.
- **Finał:** w Obserwatorium sfera armilarna zapala medalion każdej odwiedzonej komnaty.
- Plan zamku do przechodzenia między miejscami, pora dnia (dzień lub wieczór — wtedy także karty jak papier przy świecy), opcjonalna muzyka „Castello della Scienza” i tryb czytania wystawy bez 3D.

## Sterowanie

- Na początku wybierz „Wyrusz w drogę” albo dowolny świecący znacznik z nazwą miejsca.
- Przeciągnij widok, aby się rozejrzeć.
- **M** otwiera plan zamku, **Escape** zamyka okna i wychodzi z trybu filmu, **Tab** przechodzi między elementami strony.
- W oknie „O wystawie” można włączyć spokojne przejścia bez ruchu kamery i wyłączyć wysoką jakość obrazu (lżejsze renderowanie na słabszych komputerach).

## Wymagania

Aktualna przeglądarka z WebGL 2 i WebAssembly (Chrome, Edge, Firefox lub Safari) na komputerze lub telefonie. Pierwsze wczytanie pobiera około 29 MB (model 3D, faktury i biblioteki). Filmy pobierają się dopiero w odwiedzanych komnatach, a muzyka — po jej włączeniu.

## Uruchomienie lokalne

Strona jest statyczna i nie wymaga budowania. Moduły JavaScript nie działają po otwarciu pliku `index.html` bezpośrednio z dysku, dlatego potrzebny jest dowolny lokalny serwer HTTP uruchomiony w katalogu repozytorium, np.:

```
python -m http.server 8000
```

Następnie otwórz http://localhost:8000/.

## Zawartość repozytorium

Repozytorium zawiera wyłącznie pliki potrzebne do działania strony:

| Ścieżka | Zawartość |
|---|---|
| `index.html`, `style.css`, `exhibit-card.css` | strona i wygląd interfejsu |
| `app.js` | spacer, kamera, światło, tryb filmu |
| `look.js` | niebo, góry, materiały i faktury liczone w przeglądarce |
| `observatory.js`, `exhibits.js` | sfera armilarna finału, latarnia w komnacie Światło |
| `science.js` | doświadczenia i ich modele liczbowe |
| `evening.js`, `lanterns.js`, `gates.js`, `flags.js`, `music.js`, `paper.js` | wieczór, wrota, chorągwie, muzyka, papierowe karty |
| `stations.json` | treści komnat i źródła |
| `models/` | model zamku (glTF z kompresją Draco) i tekstura wody |
| `textures/` | fotograficzne faktury kamienia, bruku, drewna, łupku, skał i traw (JPEG), autorzy w `textures/CREDITS.txt` |
| `media/` | filmy komnat (H.264, bez dźwięku) |
| `audio/` | muzyka (Opus i AAC) |
| `vendor/` | używane moduły three.js i dekoder Draco |

Edytowalny projekt Blendera, skrypty produkcyjne i dokumentacja powstawania wystawy nie są częścią tego repozytorium.

## Uwagi o treściach

- Filmy są generatywnymi wizualizacjami, a nie nagraniami eksperymentów. Ograniczenia każdego filmu opisano przy odpowiedniej komnacie.
- Doświadczenia są uproszczeniami dydaktycznymi; ich założenia podaje okno „Szczegóły i źródła”. Tempo ruchu prądu w komnacie Elektryczność jest umowne.
- Rozkłady prawdopodobieństwa w komnacie Informacja i AI ustalono ręcznie. Nie pochodzą z działającego modelu językowego.

## Licencje i autorzy materiałów

- [three.js](https://threejs.org/) r180 — licencja MIT, tekst w `vendor/THREE-LICENSE.txt`.
- [Draco](https://github.com/google/draco) — dekoder geometrii, licencja Apache 2.0, tekst w `vendor/libs/draco/LICENSE.txt`.
- Faktury z [Poly Haven](https://polyhaven.com) — licencja CC0 (domena publiczna); lista zestawów i autorów w `textures/CREDITS.txt`. Część faktur przetworzono na potrzeby wystawy (usunięte fugi, przycięcie, kompresja).
