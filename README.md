# Zamek Tajemnic Rzeczywistości

Interaktywna podróż 3D po zamku-muzeum nad jeziorem. Dziesięć komnat opowiada o tym, jak działa świat: światło, czas, grawitacja, ruch, energia, elektryczność, magnetyzm, materia, życie oraz informacja i sztuczna inteligencja.

**Zwiedzaj:** https://apkmason.dev/zamek/

## Co znajdziesz w środku

- Prowadzony spacer: plac przedbramny → most → Wielka Sala → komnaty 01–10 → Obserwatorium → taras → belweder → powrót na plac. Po drodze można odpocząć na Dziedzińcu Harmonii.
- W każdej komnacie: przestrzenny artefakt, film ilustracyjny, karta z opisem, interaktywny model zjawiska ze suwakiem oraz źródła.
- Plan zamku do przechodzenia między komnatami, opcjonalna muzyka „Castello della Scienza” i tryb czytania wystawy bez 3D.

## Sterowanie

- Wybieraj świetlne znaczniki z nazwami miejsc.
- Przeciągnij widok, aby się rozejrzeć.
- **M** otwiera plan zamku, **Escape** zamyka okna, **Tab** przechodzi między elementami strony.
- W oknie „O wystawie” można włączyć spokojne przejścia bez ruchu kamery i wyłączyć wysoką jakość obrazu.

## Wymagania

Aktualna przeglądarka z WebGL 2 i WebAssembly (Chrome, Edge, Firefox lub Safari). Pierwsze wczytanie pobiera około 22 MB (model 3D i biblioteki). Filmy pobierają się dopiero w odwiedzanych komnatach, a muzyka — po jej włączeniu.

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
| `index.html`, `app.js`, `science.js`, `music.js`, `style.css`, `exhibit-card.css` | aplikacja |
| `stations.json` | treści komnat i źródła |
| `models/` | model zamku (glTF z kompresją Draco) i tekstura wody |
| `media/` | filmy komnat (H.264, bez dźwięku) |
| `audio/` | muzyka (Opus i AAC) |
| `vendor/` | używane moduły three.js i dekoder Draco |

Edytowalny projekt Blendera, skrypty produkcyjne i dokumentacja powstawania wystawy nie są częścią tego repozytorium.

## Uwagi o treściach

- Filmy są generatywnymi wizualizacjami, a nie nagraniami eksperymentów. Ograniczenia każdego filmu opisano przy odpowiedniej komnacie.
- Modele interaktywne są uproszczeniami dydaktycznymi; ich założenia podaje sekcja „Głębiej i źródła”.
- Rozkłady prawdopodobieństwa w komnacie Informacja i AI ustalono ręcznie. Nie pochodzą z działającego modelu językowego.

## Biblioteki zewnętrzne

- [three.js](https://threejs.org/) r180 — licencja MIT, tekst w `vendor/THREE-LICENSE.txt`.
- [Draco](https://github.com/google/draco) — dekoder geometrii, licencja Apache 2.0, tekst w `vendor/libs/draco/LICENSE.txt`.
