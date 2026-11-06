# I Giardini di Milano

Foto geolocalizzate degli spazi verdi di Milano — curati e in degrado — su una
mappa. Un sito documentaristico: le foto e i fatti visibili parlano, il sito non
giudica.

**Sito pubblicato:** https://lukather.github.io/igiardinidimilano/

Lo stato del verde pubblico cambia enormemente da un quartiere all'altro, ma la
differenza non è visibile se non camminandoci accanto. Il sito la rende leggibile
a colpo d'occhio: marker verdi per gli spazi curati, rossi per quelli in degrado,
foto e descrizione al clic.

Il sito è **statico**: nessun server, nessun database a runtime, nessun dato
raccolto dai visitatori. Le foto sono pubblicate a mano dal proprietario e il
build produce una cartella `dist/` deployabile su qualsiasi hosting statico.

## Requisiti

- Node.js 18 o superiore
- npm

## Avvio rapido

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # produce dist/ (dati + sito)
npm run preview    # serve dist/ in locale
npm run typecheck  # controllo dei tipi
npm run test       # test in watch
npm run test:run   # test una volta sola (come in CI)
```

## Pubblicare una foto

Una foto pubblicata è **due file nel repo**, più il dato aggregato rigenerato:

```
src/photos/{id}.jpg          immagine ottimizzata, senza alcun metadato
src/data/photos/{id}.json    metadati (coordinate, data, categoria, spazio, descrizione)
src/data/photos.json         dato aggregato letto dal sito (rigenerato dal build)
```

L'originale della foto **non entra mai nel repo**: vive fuori, e da lì viene
estratto il GPS, confermato a mano, ottimizzato e ripulito. Ci sono due modi per
pubblicare, con la stessa pipeline sotto.

### Dal pannello di amministrazione (consigliato)

```bash
npm run admin      # http://127.0.0.1:3001/admin
```

Interfaccia locale: trascini la foto, clicchi la posizione sulla mappa,
compili i campi, carichi. Il pannello rigenera già `src/data/photos.json`.
Poi `npm run build` per aggiornare `dist/`, e commit.

I campi sono data, categoria, nome dello spazio, descrizione e — facoltativo —
**autore**: il nome o nick di chi ha scattato. Lasciato vuoto non viene scritto
nei metadati, e la foto non mostra alcun credito per foto.

Il pannello ascolta solo su loopback e non ha autenticazione: **non va
deployato**. Gli upload sono limitati a 25 MB (`ADMIN_MAX_UPLOAD_MB`), la porta
si cambia con `ADMIN_PORT`.

### Da riga di comando

```bash
npm run ingest /percorso/alla/foto-originale.jpg
```

Lo script propone le coordinate lette dall'EXIF e la data, chiede conferma o
correzione, poi chiede categoria, nome dello spazio, descrizione e autore. Se la
foto non ha GPS, le coordinate si inseriscono a mano come `lat,lon`.

L'autore è l'unica domanda facoltativa: `Author (optional, press Enter to skip)`.
Premendo Invio il campo non viene scritto affatto — non come stringa vuota.

### Regole per la foto

**Categoria** — descrive ciò che la foto mostra, non un giudizio sul giardino:

- `in degrado` = almeno **un** segno oggettivo visibile: rifiuti diffusi o
  accumulati; piante morte o secche diffuse; attrezzature rotte o fuori uso
  (panchine, giochi, fontane, recinzioni); pavimentazioni rotte o pericolanti;
  acqua stagnante da drenaggio guasto.
- L'erba alta **da sola non basta**: i prati naturalistici sono manutenzione,
  non abbandono. Conta solo insieme a un altro segno della lista.
- `curato` = assenza di tali segni.

**Vincoli legali** — controllati a occhio al caricamento, un'unica regola per
adulti e minori:

- nessun volto riconoscibile;
- nessuna targa leggibile;
- nessun dettaglio che identifichi una persona specifica;
- nessuna opera d'arte riconoscibile, nemmeno per caso: in Italia non esiste la
  libertà di panorama, quindi gli angoli di scatto evitano statue, monumenti e
  murales.

**Metadati** — tutti rimossi (EXIF, IPTC, XMP, ICC) prima che l'immagine entri
nel repo. L'unica geolocalizzazione pubblicata è quella confermata a mano nei
metadati della foto. Il build si rifiuta di pubblicare un'immagine che porti
ancora metadati, anche se ce l'hai messa a mano.

## Come si costruisce il sito

```bash
npm run build
```

Due passi, in ordine:

1. **`npm run build:data`** — valida ogni file in `src/data/photos/`, verifica
   che l'immagine referenziata esista, calcola i contatori e scrive
   `src/data/photos.json`. Il file è **riproducibile**: stessi input, file
   identico byte per byte (nessun timestamp di build), quindi ricostruire senza
   cambiare contenuti lascia il working tree pulito.
2. **`npm run build:site`** — impacchetta il frontend con Vite e copia
   `photos.json` e le immagini referenziate dentro `dist/`.

I due passi si possono lanciare separatamente quando serve solo uno dei due
(`npm run build:data`, `npm run build:site`).

`dist/` è autosufficiente e deployabile così com'è: `index.html`, `assets/`,
`data/photos.json`, `photos/`. Gli URL degli asset sono relativi, quindi il sito
funziona sia alla radice di un host sia in una sotto-cartella.

### Cosa fa fallire il build

Il build è l'unico punto di validazione, e fallisce con un messaggio che nomina
il campo:

- ID non nel formato `YYYY-MM-DD-slug-NN`
- categoria fuori da `curato` / `in degrado`
- coordinate mancanti o fuori dai confini di Milano (lat 45.35–45.55, lon 8.95–9.30)
- data mancante o non valida
- descrizione fuori dai 10–500 caratteri
- nome dello spazio mancante
- autore presente ma vuoto, o più lungo di 100 caratteri (il campo è
  facoltativo: assente è valido, vuoto no)
- immagine referenziata che non esiste in `src/photos/`
- immagine che porta ancora metadati, o che è troppo piccola per essere una foto
  vera (soglia anti-segnaposto)

### Modello dati

```json
{
  "id": "2024-01-15-parco-sempione-01",
  "category": "curato",
  "coordinates": { "latitude": 45.4642, "longitude": 9.19 },
  "date": "2024-01-15",
  "description": "Parco ben curato, prato tagliato e panchine integre",
  "space": "Parco Sempione",
  "imageFile": "2024-01-15-parco-sempione-01.jpg",
  "author": "Lorenzo"
}
```

L'unità di contenuto è la foto. Lo "spazio verde" è un campo testuale, non una
scheda: più foto possono condividere lo stesso `space`. La categoria è binaria
in v1 ma il modello ammette valori futuri senza migrazione.

`author` è l'unico campo facoltativo: quando c'è, il popup della mappa mostra
"Foto di …"; quando manca, la foto è comunque valida e non compare alcuna riga
di credito.

### ID e sovrascritture

Un ID è `YYYY-MM-DD-spazio-slug-NN`, dove `NN` distingue le foto che
condividono data e spazio. **Pubblicare non sovrascrive mai una foto esistente**:
viene assegnato il primo indice libero (`-01`, poi `-02`, …), e i buchi vengono
riempiti. Per sostituire una foto si cancellano prima il suo JSON e la sua
immagine: non esiste un percorso di sovrascrittura, per scelta.

### Budget immagini

I valori vivono in un solo posto, `src/scripts/image-budget.ts`:

| Impostazione | Valore |
|---|---|
| Lato più lungo | 1600 px |
| Dimensione target | 300 KB |
| Qualità iniziale | 80 |
| Qualità minima | 60 (mai sotto) |
| Risoluzioni di ripiego | 1400, 1200 px |

L'ottimizzatore abbassa prima la qualità e solo dopo la risoluzione. Se il
target resta irraggiungibile scrive il file più piccolo accettabile e lo dice:
il budget è indicativo, quindi una foto sopra budget viene **segnalata**, mai
degradata sotto la soglia di qualità né pubblicata in silenzio.

## Deploy

Il deploy avviene da GitHub Actions su GitHub Pages a ogni push su `main`
(`.github/workflows/deploy.yml`): il workflow esegue typecheck e test, costruisce
`dist/` e lo pubblica. Il sito è su
https://lukather.github.io/igiardinidimilano/.

Su un repo nuovo l'unico passaggio manuale, una volta sola, è
**Settings → Pages → Build and deployment → Source: GitHub Actions**. Pages è
gratuito per i repo pubblici; su un repo privato richiede un piano a pagamento.

Per usare un altro hosting statico (Netlify, Cloudflare Pages, un bucket S3, un
server nginx) non serve configurazione: si pubblica il contenuto di `dist/`. Su
Netlify o Cloudflare Pages bastano come impostazioni:

```
Build command:    npm run build
Publish directory: dist
```

Il dominio pubblico è una decisione ancora aperta e non blocca il deploy.

## Test

```bash
npm run test:run
npm run typecheck
```

Entrambi girano in CI a ogni push e a ogni pull request
(`.github/workflows/ci.yml`), insieme al build.

La suite segue una regola sola: **asserisce su ciò che la pipeline produce, non
su come è costruita**. Il seam è il build: `src/site-build.test.ts` esegue il
build dei dati e un build Vite reale su fixture generate, poi ispeziona gli
artefatti (immagini senza metadati, dati coerenti, landing page, fallimenti di
validazione). Gli altri file coprono il modello dati, l'allocazione degli ID, il
pannello admin e le risposte ai prompt di ingest.

## Problemi comuni

**`Site data not found at src/data/photos.json`** — il dev server è partito senza
il dato aggregato: lancia `npm run build:data` e ricarica.

**`Address already in use`** avviando il pannello admin — un altro processo
occupa la porta: chiudilo, oppure `ADMIN_PORT=3002 npm run admin`.

**`Coordinates are outside Milan bounds`** — il build rifiuta coordinate fuori
dall'area comunale (lat 45.35–45.55, lon 8.95–9.30). Correggile nel JSON della
foto, o rifai l'ingest.

**`⚠️ Over budget`** — la foto è pubblicata comunque: il budget è indicativo.
Se vuoi rientrarci, rilancia l'ingest dall'originale o regola i valori in
`src/scripts/image-budget.ts`.

**`No GPS data found in photo EXIF`** — la foto non ha coordinate: l'ingest le
chiede a mano, nel formato `lat,lon`.

## Struttura del repo

```
src/
  index.html              landing (hero a confronto + mappa + footer)
  main.ts                 bootstrap del sito: dati, hero, mappa, filtri
  popup.ts                contenuto del popup dei marker
  map-tiles.ts            provider dei tile (una sola costante)
  category.ts             categorie e relativa semantica
  styles/main.css         stili del sito
  types/                  tipi, schemi zod, validazione
  scripts/
    ingest.ts             ingest da riga di comando
    build.ts              validazione + dato aggregato
    emit-site-assets.ts   copia dati e foto dentro dist/
    optimize-image.ts     ridimensionamento, compressione, strip metadati
    image-budget.ts       il budget immagini, in un posto solo
    photo-id.ts           allocazione degli ID senza sovrascritture
  admin/                  pannello di authoring locale (mai deployato)
  photos/                 immagini pubblicate (ottimizzate, senza metadati)
  data/photos/            metadati delle foto
  data/photos.json        dato aggregato generato dal build
tests/fixtures/           generatori di immagini sintetiche per i test
docs/agents/              note di lavoro per gli agenti (issue tracker, dominio)
```

Stack: TypeScript, Vite, Leaflet, sharp. Tile della mappa da un CDN keyless
conforme alla policy OpenStreetMap (`tile.openstreetmap.de`, FOSSGIS e.V.),
nessuna chiave API.

## Licenza

Le foto e i testi sono distribuiti con licenza
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.it): la
stampa locale può riutilizzarli con la sola attribuzione a "I Giardini di
Milano". Il testo completo è in [LICENSE](LICENSE). Il codice sorgente non è
coperto da quella licenza.

## Riferimenti

- Specifica v1 completa: [issue #7](https://github.com/Lukather/igiardinidimilano/issues/7)
- Note di lavoro per gli agenti: `docs/agents/`
