# Google Play Console: what to enter

For Route Forge (`app.routeforge`), first release 1.0.0. Fill these in once Google has verified your identity.
The build to upload: https://expo.dev/artifacts/eas/lO5wTRb6KX9rCrGm88eHvDm9lU9-W0y22AOSRaJfaiY.aab (1.0.0, version
code 2).

## 1. Create the app

Play Console → **Create app**:

| Field | Answer |
| --- | --- |
| App name | Route Forge |
| Package name | `app.routeforge` (must match `app.json`; can never change) |
| Default language | English (United Kingdom) – en-GB |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both (Developer Program Policies, US export laws) |

## 2. Store listing (Grow → Store presence → Main store listing)

Add German (de-DE) and Bulgarian (bg) as translations with **Manage translations → Add your own translations**.

**Short description** (80 characters max)

- EN: `Shifts, hours and pay for courier teams: log, review and approve in one app.`
- DE: `Schichten, Stunden und Lohn für Kurierteams: erfassen, prüfen, freigeben.`
- BG: `Смени, часове и заплащане за куриерски екипи – в едно приложение.`

**Full description**

EN:

```
Route Forge is the work app for courier firms. Couriers log their day, dispatchers review it, and owners see the whole firm, including pay.

FOR COURIERS
• Start your shift with one tap and fill in kilometres, packages and pickups as you go.
• Take the vehicle check photos (bus, logbook, Mentor score, fuel) right in the app.
• See your hours, pay and Spesen for every month, and every day's status in a calendar.
• Keep your documents (ID card, driving licence, tax and insurance details) in one place, with expiry reminders.

FOR DISPATCHERS
• Approve or send back shifts from your depots, with the photos alongside.
• Correct times and kilometres; every change is recorded.
• Filter by depot, courier or bus, and see who is missing photos.

FOR OWNERS
• Depots, cars and their papers (TÜV, insurance, service), with warnings before they run out.
• Pay rates per courier or for the whole firm, hourly or per day, with break and Spesen rules.
• Invite couriers, dispatchers and mechanics by email.

FOR MECHANICS
• Every car's papers and a service log with photos.

Route Forge is used by invitation: your firm's owner adds you by email. It is available in English, German and Bulgarian.
```

DE:

```
Route Forge ist die Arbeits-App für Kurierfirmen. Fahrer erfassen ihren Tag, Disponenten prüfen ihn, und Inhaber sehen die ganze Firma, auch den Lohn.

FÜR FAHRER
• Schicht mit einem Tipp starten und Kilometer, Pakete und Abholungen nebenbei eintragen.
• Fotos der Fahrzeugkontrolle (Bus, Fahrtenbuch, Mentor-Wert, Tankanzeige) direkt in der App.
• Stunden, Lohn und Spesen für jeden Monat und den Status jedes Tages im Kalender.
• Dokumente (Personalausweis, Führerschein, Steuer- und Versicherungsdaten) an einem Ort, mit Erinnerung vor Ablauf.

FÜR DISPONENTEN
• Schichten der eigenen Depots freigeben oder zurückschicken, mit den Fotos daneben.
• Zeiten und Kilometer korrigieren; jede Änderung wird festgehalten.
• Nach Depot, Fahrer oder Bus filtern und sehen, wem Fotos fehlen.

FÜR INHABER
• Depots, Fahrzeuge und ihre Papiere (TÜV, Versicherung, Service), mit Warnung vor Ablauf.
• Lohnsätze pro Fahrer oder für die ganze Firma, Stunden- oder Tageslohn, mit Pausen- und Spesenregeln.
• Fahrer, Disponenten und Mechaniker per E-Mail einladen.

FÜR MECHANIKER
• Die Papiere jedes Fahrzeugs und ein Servicebuch mit Fotos.

Route Forge funktioniert auf Einladung: Der Inhaber deiner Firma fügt dich per E-Mail hinzu. Die App gibt es auf Deutsch, Englisch und Bulgarisch.
```

BG:

```
Route Forge е работното приложение за куриерски фирми. Куриерите въвеждат деня си, диспечерите го проверяват, а собствениците виждат цялата фирма, включително заплащането.

ЗА КУРИЕРИ
• Започнете смяната с едно докосване и въвеждайте километри, пратки и взимания в движение.
• Снимките от проверката на автомобила (бус, пътен лист, оценка в Mentor, гориво) – направо в приложението.
• Часове, заплащане и командировъчни (Spesen) за всеки месец и статусът на всеки ден в календар.
• Документите ви (лична карта, шофьорска книжка, данъчни и осигурителни данни) на едно място, с напомняне преди изтичане.

ЗА ДИСПЕЧЕРИ
• Одобрявайте или връщайте смени от вашите депа, със снимките до тях.
• Коригирайте часове и километри; всяка промяна се записва.
• Филтрирайте по депо, куриер или бус и вижте на кого липсват снимки.

ЗА СОБСТВЕНИЦИ
• Депа, автомобили и документите им (TÜV, застраховка, сервиз), с предупреждение преди изтичане.
• Ставки за всеки куриер или за цялата фирма, на час или на ден, с правила за почивки и Spesen.
• Канете куриери, диспечери и механици по имейл.

ЗА МЕХАНИЦИ
• Документите на всеки автомобил и сервизен дневник със снимки.

Route Forge работи с покана: собственикът на фирмата ви ви добавя по имейл. Приложението е на български, английски и немски.
```

**Graphics** (you make these)

- App icon: 512 × 512 PNG. Export it from `assets/images/icon.png` (the amber route on ink).
- Feature graphic: 1024 × 500 PNG or JPG.
- Phone screenshots: at least 2 (1080 × 1920 or similar), from the Samsung: Shifts, Pay, Approvals, Vehicle check.
  Use the dev test firm, never real couriers' data.

**Category and contact** (Store settings)

| Field | Answer |
| --- | --- |
| App category | Business |
| Tags | Business, Productivity |
| Email | support@routeforge.app |
| Website | https://route-forge.expo.app (optional) |
| External marketing | Off |

## 3. App content (Policy → App content)

**Privacy policy**: `https://route-forge.expo.app/privacy`

**App access**: *All or some functionality is restricted*. Google's reviewers need a working login on the
**production** app, so before you submit (see step 5 below), create a reviewer account and enter:

- Name: `Reviewer (owner)`
- Username: the reviewer's email, e.g. `review@routeforge.app`
- Password: its password
- Other instructions: `Sign in with email and password. The account is the owner of a demo firm with test data;
  it sees the Approvals, Team and Profile tabs. Courier screens: use courier login <second account>.`

**Ads**: No, my app does not contain ads.

**Content rating** (questionnaire): email support@routeforge.app, category **All other app types**. Answer
**No** to every question (violence, sexuality, language, controlled substances, gambling, user-to-user
communication or content sharing, location sharing, digital purchases). Expected result: rated for everyone
(PEGI 3 / USK 0).

**Target audience**: **18 and over** only. "Could your store listing unintentionally appeal to children?" No.

**News app**: No. **Government app**: No. **Health apps**: none of these. **Financial features**: My app doesn't
provide any financial features (it shows pay, it doesn't move money).

**Data safety**:

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes |
| Which account creation methods does your app support? | Username and password, OAuth (Google), Other (email code) |
| Do you provide a way for users to request that their data is deleted? | Yes |
| Delete account URL | `https://route-forge.expo.app/delete-account` |

Data types (for every one: **Collected: yes, Shared: no**, processed ephemerally: **no**):

| Data type | Required or optional | Purposes |
| --- | --- | --- |
| Personal info → Name | Required | App functionality, Account management |
| Personal info → Email address | Required | App functionality, Account management |
| Personal info → User IDs | Required | App functionality, Account management |
| Personal info → Address | Optional | App functionality |
| Personal info → Phone number | Optional | App functionality |
| Personal info → Other info (ID card and licence numbers, tax ID, social security number, health insurance) | Optional | App functionality |
| Financial info → Other financial info (bank account, pay rate and pay) | Optional | App functionality |
| Photos and videos → Photos | Optional | App functionality |
| App activity → Other user-generated content (shifts, kilometres, packages, service log notes) | Required | App functionality |
| App info and performance → Crash logs | Required | App functionality |
| App info and performance → Diagnostics | Required | App functionality |

Leave everything else unticked: location, contacts, messages, audio, files, calendar, health, web browsing, device
IDs, purchase history, ads.

"Shared: no" is right because Clerk, Neon, Cloudflare, Expo and Sentry are service providers processing for us,
which Google doesn't count as sharing.

## 4. Testing track and release

New personal developer accounts must run a **closed test with at least 12 testers for 14 days in a row** before
Google allows a production (public) release. Check the current rule in Play Console under Dashboard.

1. Testing → **Closed testing** → Create track (e.g. "Ivanov Transport").
2. Testers: an email list (the couriers' and dispatchers' Google accounts, at least 12 people).
3. Create release → upload the `.aab` above → release name `1.0.0 (2)` → release notes: `First release.`
4. Send the testers the opt-in link from the track page; they install from the Play Store.

The closed track can stay the way Ivanov Transport installs the app; going public later is optional.

## 5. Before submitting for review: the reviewer account (production)

Google's reviewers sign in to the production app, so they need a real login there:

1. In Cloudflare Email Routing, add a rule `review@routeforge.app` → your Gmail (like support@).
2. In the production app, sign up as `review@routeforge.app` with a password.
3. In the Clerk dashboard (production instance), create an organization "Route Forge Demo" with that user as
   admin. They become its owner in the app.
4. Sign in as the reviewer, set up a depot and a car, and add a second account as a courier with one shift, so
   every screen has something to show.

That demo firm lives in the production database, apart from every real firm.
