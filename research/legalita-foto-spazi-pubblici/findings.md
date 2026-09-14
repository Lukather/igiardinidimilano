# Ricerca: legalità delle foto di spazi pubblici con persone

Ticket: [Legalità delle foto di spazi pubblici con persone](https://github.com/Lukather/igiardinidimilano/issues/2) · Mappa: [Spec v1: I Giardini di Milano](https://github.com/Lukather/igiardinidimilano/issues/1)

## Domanda

Cosa dice la legge italiana — e il GDPR — sulla pubblicazione online, in un sito documentaristico di interesse pubblico, di foto scattate in spazi pubblici di Milano in cui compaiono persone identificabili o non identificabili (diritto all'immagine, artt. 96–97 l. 633/1941)? Ci sono vincoli particolari per foto di beni comunali o di proprietà privata visibile dalla strada?

## Risposta in breve

- **Persone non identificabili** (volti irriconoscibili, figure lontane, controluce, sfocati): pubblicabili senza problemi. Gli artt. 96–97 l. 633/1941 si applicano al *ritratto* di una persona *identificabile*.
- **Persone identificabili**: la regola base è che serve il consenso (art. 96 l. 633/1941). L'art. 97 permette la pubblicazione senza consenso quando la riproduzione è "collegata a fatti, avvenimenti, cerimonie di interesse pubblico o svoltisi in pubblico" — ma **vietata comunque se reca pregiudizio all'onore, alla reputazione o al decoro** (art. 97, comma 2). La giurisprudenza è cauta: l'interesse pubblico a un fatto non legittima *automaticamente* la diffusione dell'immagine della persona.
- **Regola pratica per il sito**: nessun primo piano di privati cittadini riconoscibili; preferire scatti senza persone o con persone non identificabili. Il soggetto del sito sono gli spazi verdi, non le persone.
- **Minori**: massima cautela — il Garante raccomanda di rendere irriconoscibile il viso (pixellare) o non pubblicare.
- **Beni comunali** (parchi pubblici): fotografabili da luogo pubblico senza vincoli dell'art. 96–97. Attenzione separata a **opere d'arte/sculture** come soggetto principale: in Italia *non* esiste libertà di panorama (dettagli sotto).
- **Proprietà privata visibile dalla strada**: fotografabile ciò che si vede da luogo pubblico; **mai** riprendere all'interno di spazi privati (teleobiettivo oltre recinzione, drone): il Garante lo indica come sempre da evitare, con rischio di norme penali.
- **GDPR**: le immagini con persone identificabili sono dati personali → serve una base giuridica (art. 6 GDPR: legittimo interesse con bilanciamento documentato, oppure consenso). Il Garante, in via divulgativa, consiglia il consenso come baseline per immagini di terzi.
- **EXIF/geotag**: strippare sempre i metadati delle foto originali; la geolocalizzazione del sito è deliberata (coordinate del giardino inserite a mano), non ereditata dal file.

## Findings dettagliati

### 1. Persone identificabili: artt. 96–97 l. 633/1941

**Art. 96** (fonte primaria: Normattiva, testo consolidato; testo identico su Doctrine):

> "Il ritratto di una persona non può essere esposto, riprodotto o messo in commercio senza il consenso di questa, salve le disposizioni dell'articolo seguente."

- Fonte: [Normattiva — L. 633/1941 consolidato](https://www.normattiva.it/eli/id/1941/07/16/041U0633/CONSOLIDATED/20241015) · [Doctrine, art. 96](https://www.doctrine.it/norms/laws/itatextvvwowxi2sklvkn/articles/itaartlmfwpx60cd4gvlm)

**Art. 97** (fonte primaria: Doctrine, versione in vigore dal 18/12/1942 — comma 1 invariato nel consolidato):

> "Non occorre il consenso della persona ritrattata quando la riproduzione dell'immagine è giustificata dalla notorietà o dall'ufficio pubblico coperto, da necessità di giustizia o di polizia, da scopi scientifici, didattici o culturali, o quando la riproduzione è collegata a fatti, avvenimenti, cerimonie di interesse pubblico o svoltisi in pubblico."
>
> "Il ritratto non può tuttavia essere esposto o messo in commercio, quando l'esposizione o messa in commercio rechi pregiudizio all'onore, alla reputazione od anche al decoro della persona ritrattata."

- Fonte: [Doctrine, art. 97](https://www.doctrine.it/norms/laws/itatextvvwowxi2sklvkn/articles/itaartfimwahsxde3gfg)

Lettura operativa per il sito: le foto di giardini pubblici sono "collegate a fatti/avvenimenti svoltisi in pubblico" — l'eccezione dell'art. 97 comma 1 copre in linea di principio la pubblicazione documentaristica; il comma 2 è il limite invalicabile (niente immagini che umilino o espongano le persone, nemmeno in un parco).

### 2. La cautela giurisprudenziale: l'interesse pubblico non basta da solo

Tribunale Roma, sent. 2/5/2023, n. 6837 (citata su Doctrine, che riporta Cass. sul punto):

> "[…] il prevalente diritto dell'opinione pubblica ad essere informata […] possono risultare idonei a giustificare la propalazione di informazioni in contrasto con i predetti diritti, ma **non sono sufficienti a legittimare anche la diffusione della immagine della persona interessata, la quale trova un'autonoma e più rigorosa disciplina nell'art. 10 c.c. e nell'art. 97 legge 633/1941**."

- Fonte: [Doctrine — Trib. Roma 6837/2023](https://www.doctrine.it/norms/laws/itatextvvwowxi2sklvkn/articles/itaartfimwahsxde3gfg) (fonte secondaria che riporta il testo della decisione).

In pratica: anche quando la cronaca/documentazione è legittima, l'immagine della persona specifica è tutelata *separatamente*. Da qui la regola pratica "no primi piani di riconoscibili".

**Limite dichiarato**: il test del "primo piano" (ritratto ravvicinato vs figura incidentale) è prassi dottrinale consolidata ma qui non verificata contro giurisprudenza primaria (Cass. 1748/2016, 1875/2019, ord. 19515/2022 emerse in ricerca ma non estratte da fonte verificabile). Da non usare come fondamento fine a sé stesso: la politica pratica del ticket #3 dev'essere più conservativa del minimo legale.

### 3. Indicazioni del Garante privacy

**Vademecum ufficiale "Consigli per tutelare la tua privacy se metti immagini online"** (Garante, novembre 2020, docweb 3766930):

> "Pubblica immagini di altre persone solo con il loro consenso. Potrebbero non voler apparire online o sentirsi in imbarazzo."

- Fonte: [Garante privacy — PDF docweb 3766930](https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/3766930)

**"E-state in privacy"** (Garante, pagina ufficiale):

> "Se si postano foto o video in cui compaiono altre persone, è sempre meglio prima accertarsi che queste siano d'accordo, specie se si inseriscono poi anche dei tag con nomi e cognomi."
>
> (sui minori) "le immagini dei minori pubblicate online possono finire anche nelle mani di malintenzionati: meglio quindi evitare di postarle, oppure […] rendere irriconoscibile il viso del minore (ad esempio […] 'pixellare' i volti…)"
>
> (su drone/teleobiettivo in spazi privati) "Le riprese che violano gli spazi privati altrui (es: la casa delle vacanze, la camera d'albergo, ecc.) sono invece sempre da evitare, anche perché si potrebbero violare norme penali." — e: "evitare di invadere gli spazi personali e l'intimità delle persone", evitare immagini con "dati personali come targhe di macchine".
>
> (su geolocalizzazione) "il suggerimento è disattivare le opzioni di geolocalizzazione di smartphone e tablet".

- Fonte: [Garante privacy — E-state in privacy](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9020684)

Il Garante parla a privati che postano; un sito documentaristico può invocare l'art. 97, ma le sue indicazioni (assenza consenso → cautela; minori pixellati; no targhe; no spazi privati; no geotag da dispositivo) sono la baseline prudente raccomandata.

### 4. GDPR: le immagini con persone identificabili sono dati personali

**Principi fondamentali del trattamento** (Garante, pagina ufficiale che illustra il Reg. UE 2016/679):

> "Il Regolamento […] prevede che ogni trattamento deve trovare fondamento in un'idonea base giuridica. I fondamenti di liceità del trattamento di dati personali sono indicati all'articolo 6 del Regolamento: consenso, adempimento obblighi contrattuali, interessi vitali della persona interessata o di terzi, obblighi di legge cui è soggetto il titolare, interesse pubblico o esercizio di pubblici poteri, interesse legittimo prevalente del titolare o di terzi…"

> (interesse legittimo) "presuppone che il titolare stesso effettui un bilanciamento fra il legittimo interesse suo o del terzo e i diritti e libertà dell'interessato."

- Fonte: [Garante privacy — Principi fondamentali del trattamento](https://www.garanteprivacy.it/it/home/principi-fondamentali-del-trattamento)

**Limite dichiarato**: il testo verbatim degli artt. 4(1) e 6(1) GDPR da EUR-Lex non è stato estratto (pagina troppo grande per l'estrazione). La sintesi ufficiale del Garante sopra è usata come riferimento; per la spec v1 non serve altro livello di dettaglio.

Conseguenza per il sito: una foto con persona riconoscibile = dato personale. Se il sito pubblica solo foto senza volti riconoscibili (regola pratica sopra), il trattamento di immagini-ritratto non entra in gioco e il carico GDPR si riduce a: informativa breve + (consigliato) minimizzazione. La base "legittimo interesse" con bilanciamento documentato resta comunque per le foto con passanti non identificabili ma riconoscibili come persone.

### 5. Beni comunali e proprietà privata: la "libertà di panorama" in Italia

**Fonte secondaria** (pagina informativa di Wikipedia che cita i testi di legge — verificare i passaggi normativi su Normattiva prima di usarli in contesti oltre questo sito):

> "La legge italiana sul diritto d'autore non contiene alcuna eccezione per le fotografie scattate in luoghi pubblici. Quindi, la libertà di panorama non è prevista. L'uso delle immagini di opere tutelate esposte al pubblico è tuttavia possibile, al pari di tutte le opere tutelate, in alcuni casi per scopo di critica. L'art. 70 della Legge 633/1941 consente la riproduzione fotografica di opere con fini 'di critica o di discussione' e 'purché non costituisca concorrenza all'utilizzazione economica dell'opera'."

- Fonte: [Wikipedia — Aiuto:Copyright immagini/Libertà di panorama](https://it.wikipedia.org/wiki/Wikipedia:PANORAMA)

Lettura operativa per il sito (soggetti = spazi verdi, non opere d'arte):

- **Giardini, prati, alberi, aiuole**: nessuna tutela di diritto d'autore — fotografabili e pubblicabili liberamente.
- **Sculture/installazioni artistiche nei parchi**: possibile problema di diritto d'autore se l'opera è il *soggetto principale* della foto (niente libertà di panorama in Italia; la difesa "critica/discussione" dell'art. 70 è discussa). Regola pratica: evitarle come soggetto principale; da incidental non è un problema.
- **Edifici privati/giardini visti dalla strada**: nessun diritto del proprietario sull'immagine del bene per foto da luogo pubblico; divieto solo oltre la soglia della riservatezza (teleobiettivo/drone dentro spazi privati — punto 3).

## Domande aperte per il ticket "Politica legale pratica" (#3)

1. **Persone identificabili**: la regola pratica dev'essere "mai volti riconoscibili" (rigida, verificabile a colpo d'occhio) o "volti riconoscibili ok se incidentali e non lesivi" (flessibile, giudizio caso per caso)? La ricerca suggerisce la rigida.
2. **Minori**: pixellare sempre i volti o escludere foto con minori del tutto?
3. **Targhe e oggetti identificanti** (auto davanti a un giardino, insegne di esercizi):included o da evitare/ritoccare? Il Garante segnala le targhe come dati personali.
4. **EXIF**: strippare tutti i metadati al build (raccomandato) — confermare e decidere la precisione delle coordinate pubblicata (punto esatto del giardino vs solo nome/spazio).
5. **Opere d'arte nei parchi**: regola operativa "non come soggetto principale" — basta, o checklist al momento del caricamento?
6. **Informativa privacy sul sito**: serve una pagina informativa breve (GDPR art. 13 semplificato) dato che il sito non raccoglie dati ma pubblica immagini? Minimale: sì/no.

---

*Fonti primarie: Normattiva (L. 633/1941 consolidato), Garante privacy (pagine e vademecum ufficiali). Fonti secondarie marcate: Doctrine (testi di legge/decisioni), Wikipedia (panorama). Gap dichiarati: verbatim GDPR da EUR-Lex, giurisprudenza di Cassazione da fonte primaria, testo consolidato art. 97 verificato solo via Doctrine (versione 1942, comma invariato).* 
