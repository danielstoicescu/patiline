# Barcelona Aventura – Mara (13), Anne & Daniel 🎉

Ghid interactiv de vacanță (PortAventura + Barcelona, 4–9 noiembrie), găzduit pe **Firebase Hosting**,
cu program comun sincronizat live prin **Firestore**: locații adăugate de oricare dintre voi,
contorul de espresso al lui Daniel și „quest log”-ul Marei apar instant pe toate telefoanele.

Fără Firebase, aplicația merge oricum: totul se salvează local, pe telefonul respectiv.

## Ce face (gândită pentru telefon, în excursie)
- **Program pe zile** cu ore de deschidere, prețuri și zile gratuite (verificate online în sept. 2026; ce e marcat „Verifică” se confirmă în Maps).
- **Recomandări similare pe zone** sub fiecare zi, cu „Adaugă în program”.
- **Radar „lângă mine”**: pornit din aplicație, arată distanța pe jos până la locurile din program și dă alertă (banner + vibrație + notificare) când sunteți la ~150 m. Merge cât timp aplicația e deschisă pe ecran: un site nu poate urmări locația în fundal.
- **Navighează** (Google Maps pe jos) și **Maps & ore** (orele live) pe fiecare card. „Fixează aici” salvează poziția exactă a unui loc, pentru toți.
- **Bifează „Am fost”**, contorul de espresso, quest log-ul Marei și **notițe comune** (adresă, cod ușă, wifi), toate sincronizate live între telefoane.
- **Vreme** pe zilele excursiei (Open-Meteo, apare cu ~2 săptămâni înainte), **numărătoare inversă**, tab-ul zilei curente se selectează singur, cardul „ACUM”.
- **Offline**: după prima deschidere, aplicația pornește și fără semnal (service worker + cache Firestore). Se poate instala pe ecranul principal.

## Ce trebuie făcut o singură dată (≈10 minute)

### 1. Creează proiectul Firebase
1. Intră pe <https://console.firebase.google.com> → **Add project** (ex. `bcn-aventura`). Google Analytics poate rămâne oprit.
2. În proiect: **Build → Firestore Database → Create database** → *Start in production mode* → alege regiunea `eur3 (europe-west)`.
   Regulile de securitate se instalează automat la deploy (din `firestore.rules`).
3. **Project settings (⚙️) → General → Your apps → `</>` (Web)** → dă-i un nume (ex. `web`), **bifează „Also set up Firebase Hosting”** → Register app. Nu trebuie să copiezi nimic din cod.

### 2. Dă-i lui GitHub voie să publice
1. **Project settings → Service accounts → Generate new private key** → se descarcă un fișier `.json`.
2. În GitHub, repo-ul `patiline` → **Settings → Secrets and variables → Actions → New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT` = **tot conținutul** fișierului `.json` (copy/paste).
   - `FIREBASE_PROJECT_ID` = ID-ul proiectului (din Project settings, ex. `bcn-aventura` sau `bcn-aventura-1a2b3`).

### 3. Publică
- Automat: orice push pe `main` care atinge `bcn-aventura/` rulează workflow-ul **🔥 Deploy BCN Aventura to Firebase**.
- Manual: GitHub → **Actions → 🔥 Deploy BCN Aventura to Firebase → Run workflow** (poți alege și alt branch).

Linkul final: `https://<FIREBASE_PROJECT_ID>.web.app` – trimite-l Marei și Annei pe WhatsApp (butonul verde din aplicație face asta).

## Cum funcționează
- `public/` este ce se publică (HTML + `app.js` + `data.js` cu programul și recomandările + CSS compilat + `sw.js` + iconițe + Font Awesome local). `npm run build` recompilează CSS-ul și pune o versiune nouă în `sw.js`.
- Pe Firebase Hosting, aplicația își ia singură configurația de la `/__/firebase/init.json`, deci `firebase-config.js` poate rămâne gol.
- Datele stau în Firestore la `trips/bcn-aventura/locations/*` (locațiile adăugate) și `trips/bcn-aventura/state/shared` (cafele + quest-uri).
- Regulile (`firestore.rules`) nu cer login (ghid de familie), dar acceptă doar documente cu forma exactă așteptată.

## Lucru local
```bash
cd bcn-aventura
npm install
npm run watch     # recompilează CSS-ul la orice modificare
npm run serve     # http://localhost:5173
```
Pentru sincronizare live și local, completează `public/firebase-config.js` cu configul din Firebase Console.

## Deploy din terminal (alternativ la GitHub Actions)
```bash
npm i -g firebase-tools
firebase login
firebase use --add            # alege proiectul
npm run deploy                # build + hosting + firestore rules
```
