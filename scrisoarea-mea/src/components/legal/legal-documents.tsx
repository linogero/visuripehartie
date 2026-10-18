import Link from "next/link"

export type LegalDoc = "termeni" | "confidentialitate" | "cookies"

export const LEGAL_DOCS: Record<LegalDoc, { title: string; href: string }> = {
    termeni: { title: "Termeni și Condiții", href: "/termeni" },
    confidentialitate: { title: "Politica de Confidențialitate", href: "/confidentialitate" },
    cookies: { title: "Politica Cookies", href: "/cookies" },
}

const articleClass =
    "space-y-4 text-sm leading-7 text-slate-700 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-900 [&_h3]:pt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h4]:pt-2 [&_h4]:font-semibold [&_h4]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_a]:underline-offset-2 [&_button]:font-medium [&_button]:text-teal-700 [&_button]:underline [&_button]:underline-offset-2"

function DocLink({
    doc,
    children,
    onOpen,
}: {
    doc: LegalDoc
    children: string
    onOpen?: (doc: LegalDoc) => void
}) {
    if (onOpen) {
        return (
            <button type="button" onClick={() => onOpen(doc)}>
                {children}
            </button>
        )
    }
    return <Link href={LEGAL_DOCS[doc].href}>{children}</Link>
}

export function LegalDocument({
    doc,
    showTitle = true,
    onOpen,
}: {
    doc: LegalDoc
    showTitle?: boolean
    onOpen?: (doc: LegalDoc) => void
}) {
    return (
        <article className={articleClass}>
            {showTitle ? <h1>{LEGAL_DOCS[doc].title}</h1> : null}
            <p className="text-base text-slate-500">Platforma „Visuri pe hartie”</p>
            <p><strong>Ultima actualizare:</strong> 5 februarie 2026</p>
            {doc === "termeni" ? <TermsBody onOpen={onOpen} /> : null}
            {doc === "confidentialitate" ? <PrivacyBody onOpen={onOpen} /> : null}
            {doc === "cookies" ? <CookiesBody /> : null}
        </article>
    )
}

function TermsBody({ onOpen }: { onOpen?: (doc: LegalDoc) => void }) {
    return (
        <>
            <h3>1. Despre platformă</h3>
            <p>Visuri pe hartie este o platformă online care ajută la îndeplinirea unor dorințe concrete ale copiilor aflați în centre de plasament sau alte forme de protecție, prin intermediul unor scrisori reale, publicate de instituții partenere verificate.</p>
            <p>Platforma oferă infrastructura necesară pentru:</p>
            <ul>
                <li>publicarea dorințelor,</li>
                <li>colectarea donațiilor,</li>
                <li>îndeplinirea personală a dorințelor,</li>
                <li>redirecționarea procentelor din impozit (3,5% și sponsorizări),</li>
                <li>afișarea dovezilor de livrare și a impactului.</li>
            </ul>
            <p>Platforma nu este un magazin online și nu comercializează bunuri sau servicii.</p>

            <h3>2. Acceptarea termenilor</h3>
            <p>Prin utilizarea platformei Visuri pe hartie, prin navigare, completarea formularelor sau efectuarea unei donații, confirmați că ați citit, înțeles și acceptat acești Termeni și Condiții.</p>
            <p>Dacă nu sunteți de acord cu acești termeni, vă rugăm să nu utilizați platforma.</p>

            <h3>3. Principii fundamentale</h3>
            <p>Platforma funcționează pe baza unor principii clare:</p>
            <ul>
                <li><strong>Protecția copiilor:</strong> copiii nu au conturi și nu pot fi contactați direct.</li>
                <li><strong>Fără comision din donații:</strong> 100% din donațiile pentru dorințe sunt direcționate către îndeplinirea acestora.</li>
                <li><strong>Transparență:</strong> progresul, livrarea și impactul sunt vizibile public, într-o formă moderată.</li>
                <li><strong>Respect și demnitate:</strong> nu folosim limbaj emoțional manipulativ și nu expunem copii sau situații sensibile.</li>
            </ul>

            <h3>4. Utilizatori</h3>
            <p>Platforma poate fi utilizată de:</p>
            <ul>
                <li>Vizitatori, care pot accesa conținutul public;</li>
                <li>Donatori, cu sau fără cont;</li>
                <li>Instituții partenere, care pot publica scrisori și dovezi, doar după verificare;</li>
                <li>Operatorii platformei, care asigură moderarea și funcționarea corectă.</li>
            </ul>

            <h3>5. Scrisorile și conținutul publicat</h3>
            <p>Scrisorile sunt publicate exclusiv de instituții partenere verificate.</p>
            <p>Fiecare scrisoare:</p>
            <ul>
                <li>reprezintă o dorință concretă;</li>
                <li>are o valoare maximă implicită de 500 lei;</li>
                <li>poate include o fotografie sau un scurt clip video moderat;</li>
                <li>este verificată înainte de publicare.</li>
            </ul>
            <p>În cadrul unor campanii sponsorizate, valoarea maximă poate fi mai mare, iar acest lucru este afișat clar.</p>

            <h3>6. Donații</h3>
            <p>Donațiile efectuate prin platformă sunt:</p>
            <ul>
                <li>voluntare;</li>
                <li>nerambursabile;</li>
                <li>direcționate exclusiv către scopul afișat.</li>
            </ul>
            <p>Visuri pe hartie nu reține comisioane din donațiile pentru dorințe.</p>
            <p>Contribuțiile pentru susținerea funcționării platformei (ex. „Susține platforma”) sunt opționale și clar separate de donațiile către copii.</p>
            <p>
                Dacă o dorință este îndeplinită direct în afara fluxului de donații al platformei, după ce au existat
                deja contribuții financiare, sumele strânse nu se pierd: sunt transferate în Fondul pentru alte dorințe
                și folosite exclusiv pentru alte nevoi verificate. Transferurile sunt înregistrate separat de donațiile
                originale și pot fi consultate public pe pagina Fondului pentru alte dorințe.
            </p>

            <h3>7. Îndeplinirea personală a dorințelor</h3>
            <p>În anumite cazuri, utilizatorii pot alege să îndeplinească personal o dorință, trimițând direct cadoul.</p>
            <p>Această opțiune:</p>
            <ul>
                <li>este supusă unor reguli clare;</li>
                <li>presupune furnizarea unei dovezi de livrare;</li>
                <li>poate fi limitată sau suspendată în funcție de contextul operațional.</li>
            </ul>

            <h3>8. Dovezi de livrare și impact</h3>
            <p>Pentru marcarea unei dorințe ca îndeplinită, instituțiile partenere trebuie să furnizeze o dovadă (foto sau video), care:</p>
            <ul>
                <li>nu arată fața copilului;</li>
                <li>nu conține date personale;</li>
                <li>este moderată înainte de publicare.</li>
            </ul>
            <p>Platforma își rezervă dreptul de a respinge sau elimina dovezi care nu respectă aceste reguli.</p>

            <h3>9. Redirecționarea impozitului (3,5% și sponsorizări)</h3>
            <p>Platforma permite completarea și semnarea electronică a documentelor pentru:</p>
            <ul>
                <li>redirecționarea a 3,5% din impozit (persoane fizice);</li>
                <li>sponsorizări conform legislației fiscale (firme, PFA).</li>
            </ul>
            <p>Platforma:</p>
            <ul>
                <li>nu este un serviciu ANAF;</li>
                <li>nu garantează depunerea automată în Spațiul Privat Virtual (SPV);</li>
                <li>pregătește documentele pentru depunere de către operatorii autorizați ai ONG-ului.</li>
            </ul>

            <h3>10. Date personale</h3>
            <p>Datele personale sunt prelucrate conform <DocLink doc="confidentialitate" onOpen={onOpen}>Politicii de Confidențialitate</DocLink>.</p>
            <p>Principii esențiale:</p>
            <ul>
                <li>colectăm doar datele strict necesare;</li>
                <li>datele sensibile sunt protejate și mascate;</li>
                <li>nu vindem și nu cedăm datele către terți în scopuri comerciale.</li>
            </ul>

            <h3>11. Limitarea răspunderii</h3>
            <p>Platforma depune eforturi rezonabile pentru funcționarea corectă, însă:</p>
            <ul>
                <li>nu poate garanta lipsa totală a erorilor tehnice;</li>
                <li>nu răspunde pentru întârzieri cauzate de terți (curieri, instituții publice);</li>
                <li>nu este responsabilă pentru utilizarea necorespunzătoare a platformei de către utilizatori.</li>
            </ul>

            <h3>12. Suspendarea accesului</h3>
            <p>Ne rezervăm dreptul de a suspenda sau restricționa accesul unui utilizator ori de a elimina conținut, în cazul unor suspiciuni rezonabile de abuz, fraudă sau încălcare a acestor Termeni.</p>

            <h3>13. Modificarea termenilor</h3>
            <p>Acești Termeni pot fi actualizați periodic. Versiunea actualizată va fi publicată pe această pagină, cu menționarea datei ultimei modificări.</p>

            <h3>14. Contact</h3>
            <p>Pentru întrebări sau clarificări, ne puteți contacta la:<br />
                📧 <a href="mailto:contact@visuripehartie.ro">contact@visuripehartie.ro</a></p>
        </>
    )
}

function PrivacyBody({ onOpen }: { onOpen?: (doc: LegalDoc) => void }) {
    return (
        <>
            <h3>1. Introducere</h3>
            <p>Protejarea datelor personale este o prioritate pentru Visuri pe hartie.</p>
            <p>Această Politică explică ce date colectăm, de ce le colectăm, cum le folosim și ce drepturi aveți în legătură cu datele dumneavoastră, în conformitate cu Regulamentul (UE) 2016/679 (GDPR).</p>
            <p>Prin utilizarea platformei, confirmați că ați citit și înțeles această Politică.</p>

            <h3>2. Cine suntem</h3>
            <p>Visuri pe hartie este o platformă online care facilitează îndeplinirea unor dorințe concrete ale copiilor aflați în sistemul de protecție, prin scrisori publicate de instituții partenere verificate.</p>
            <p><strong>Operatorul de date este:</strong><br />
                Asociația pentru visuri și oportunități<br />
                CUI: 55406686<br />
                Email: <a href="mailto:contact@visuripehartie.ro">contact@visuripehartie.ro</a></p>

            <h3>3. Ce tipuri de date colectăm</h3>
            <p>Colectăm doar datele strict necesare pentru funcționarea platformei.</p>

            <h4>3.1. Date colectate de la vizitatori</h4>
            <ul>
                <li>adresa IP (în scopuri de securitate și prevenire abuz);</li>
                <li>informații despre dispozitiv și browser (statistici tehnice de bază).</li>
            </ul>

            <h4>3.2. Date colectate de la donatori</h4>
            <ul>
                <li>adresă de email;</li>
                <li>suma donată;</li>
                <li>scrisoarea susținută (dacă este cazul);</li>
                <li>date de plată procesate exclusiv de procesatori terți (Stripe).</li>
            </ul>
            <p>Platforma nu stochează datele cardului.</p>
            <p>Crearea unui cont de donator este opțională.</p>

            <h4>3.3. Date pentru redirecționarea impozitului (3,5%)</h4>
            <p>Pentru completarea formularului de redirecționare, colectăm:</p>
            <ul>
                <li>nume și prenume;</li>
                <li>CNP (prelucrat în condiții de securitate ridicată);</li>
                <li>adresă;</li>
                <li>semnătură olografă digitalizată;</li>
                <li>date de contact.</li>
            </ul>
            <p>CNP-ul este:</p>
            <ul>
                <li>validat;</li>
                <li>mascat în interfața de administrare;</li>
                <li>stocat securizat sau sub formă de hash, acolo unde este posibil.</li>
            </ul>

            <h4>3.4. Date pentru sponsorizări (20%)</h4>
            <p>Pentru firme și PFA-uri:</p>
            <ul>
                <li>denumire firmă;</li>
                <li>CUI;</li>
                <li>date de contact;</li>
                <li>valoarea sponsorizării;</li>
                <li>semnătură (pentru documentele generate).</li>
            </ul>

            <h4>3.5. Date ale instituțiilor partenere</h4>
            <ul>
                <li>nume instituție;</li>
                <li>descriere publică;</li>
                <li>județ;</li>
                <li>date de contact instituționale;</li>
                <li>dovezi de livrare (foto/video, fără date personale ale copiilor).</li>
            </ul>

            <h3>4. Datele copiilor</h3>
            <p>Visuri pe hartie nu colectează și nu prelucrează date personale ale copiilor în mod direct.</p>
            <ul>
                <li>copiii nu au conturi;</li>
                <li>nu pot fi contactați;</li>
                <li>nu apar nume complete, sau date de identificare;</li>
                <li>vârsta este afișată doar numeric (ex. „8 ani”).</li>
            </ul>
            <p>Orice conținut media este moderat înainte de publicare.</p>

            <h3>5. Scopurile prelucrării datelor</h3>
            <p>Datele sunt utilizate exclusiv pentru:</p>
            <ul>
                <li>funcționarea platformei;</li>
                <li>procesarea donațiilor;</li>
                <li>generarea documentelor fiscale;</li>
                <li>comunicarea cu utilizatorii;</li>
                <li>îndeplinirea obligațiilor legale;</li>
                <li>securitate și prevenirea fraudei;</li>
                <li>afișarea impactului într-o formă moderată.</li>
            </ul>
            <p>Nu folosim datele în scopuri comerciale sau de marketing agresiv.</p>

            <h3>6. Temeiul legal al prelucrării</h3>
            <p>Prelucrarea datelor se face în baza:</p>
            <ul>
                <li>consimțământului utilizatorului;</li>
                <li>executării unui serviciu solicitat;</li>
                <li>obligațiilor legale;</li>
                <li>interesului legitim (securitate, prevenirea abuzurilor).</li>
            </ul>

            <h3>7. Stocarea și securitatea datelor</h3>
            <p>Aplicăm măsuri tehnice și organizatorice adecvate, inclusiv:</p>
            <ul>
                <li>criptare;</li>
                <li>mascarea datelor sensibile;</li>
                <li>control strict al accesului;</li>
                <li>jurnalizare a acțiunilor administrative.</li>
            </ul>
            <p>Datele sunt păstrate doar pe perioada necesară scopurilor declarate sau conform cerințelor legale.</p>

            <h3>8. Partajarea datelor</h3>
            <p>Datele pot fi partajate doar cu:</p>
            <ul>
                <li>procesatori de plăți (Stripe);</li>
                <li>furnizori de servicii tehnice (hosting, email);</li>
                <li>autorități publice, dacă este impus de lege.</li>
            </ul>
            <p>Nu vindem și nu cedăm datele către terți în scopuri comerciale.</p>

            <h3>9. Drepturile dumneavoastră</h3>
            <p>Aveți următoarele drepturi:</p>
            <ul>
                <li>dreptul de acces;</li>
                <li>dreptul la rectificare;</li>
                <li>dreptul la ștergere (în limitele legii);</li>
                <li>dreptul la restricționarea prelucrării;</li>
                <li>dreptul la opoziție;</li>
                <li>dreptul la portabilitatea datelor;</li>
                <li>dreptul de a depune plângere la ANSPDCP.</li>
            </ul>
            <p>Pentru exercitarea drepturilor, ne puteți contacta la adresa de email de mai sus.</p>

            <h3>10. Cookie-uri</h3>
            <p>Platforma utilizează cookie-uri strict necesare pentru funcționare și, opțional, cookie-uri funcționale.</p>
            <p>Pentru detalii, consultați <DocLink doc="cookies" onOpen={onOpen}>Politica Cookies</DocLink>.</p>

            <h3>11. Modificarea politicii</h3>
            <p>Această Politică poate fi actualizată periodic. Orice modificare va fi publicată pe această pagină, cu actualizarea datei.</p>

            <h3>12. Contact</h3>
            <p>Pentru întrebări legate de confidențialitate sau protecția datelor, ne puteți contacta la:<br />
                📧 <a href="mailto:contact@visuripehartie.ro">contact@visuripehartie.ro</a></p>
        </>
    )
}

function CookiesBody() {
    return (
        <>
            <h3>1. Ce sunt cookie-urile</h3>
            <p>Cookie-urile sunt fișiere mici de text stocate pe dispozitivul dumneavoastră (computer, telefon, tabletă) atunci când vizitați un site web.</p>
            <p>Acestea ajută site-ul să funcționeze corect, să fie sigur și să ofere o experiență mai bună utilizatorilor.</p>

            <h3>2. De ce folosim cookie-uri</h3>
            <p>Platforma Visuri pe hartie folosește cookie-uri exclusiv pentru:</p>
            <ul>
                <li>funcționarea corectă a site-ului;</li>
                <li>reținerea preferințelor de consimțământ;</li>
                <li>securitate și prevenirea abuzurilor;</li>
                <li>funcționalități esențiale (autentificare, formulare, sesiuni).</li>
            </ul>
            <p>Nu folosim cookie-uri pentru publicitate agresivă sau tracking comercial.</p>

            <h3>3. Tipuri de cookie-uri utilizate</h3>

            <h4>3.1. Cookie-uri strict necesare</h4>
            <p>Aceste cookie-uri sunt esențiale pentru funcționarea platformei și nu pot fi dezactivate.</p>
            <p>Exemple:</p>
            <ul>
                <li>cookie-uri de sesiune;</li>
                <li>cookie-uri de autentificare;</li>
                <li>cookie-uri de securitate;</li>
                <li>cookie-uri pentru prevenirea abuzurilor.</li>
            </ul>
            <p>Fără acestea, platforma nu poate funcționa corect.</p>

            <h4>3.2. Cookie-uri funcționale (opționale)</h4>
            <p>Aceste cookie-uri ajută la îmbunătățirea experienței utilizatorului, de exemplu:</p>
            <ul>
                <li>reținerea preferințelor (limbă, consimțământ cookie);</li>
                <li>funcții de confort.</li>
            </ul>
            <p>Aceste cookie-uri sunt utilizate doar dacă vă exprimați consimțământul.</p>

            <h4>3.3. Cookie-uri de analiză</h4>
            <p>În prezent, Visuri pe hartie nu utilizează cookie-uri de analiză invazive (ex. tracking publicitar).</p>
            <p>Dacă, în viitor, vor fi introduse instrumente de analiză statistică, acestea vor fi:</p>
            <ul>
                <li>limitate;</li>
                <li>anonimizate;</li>
                <li>activate doar cu consimțământ explicit.</li>
            </ul>

            <h3>4. Cookie-uri terțe</h3>
            <p>Anumite funcționalități pot implica furnizori terți, de exemplu:</p>
            <ul>
                <li>procesatori de plăți (Stripe);</li>
                <li>servicii de hosting;</li>
                <li>servicii de email.</li>
            </ul>
            <p>Acești furnizori pot utiliza cookie-uri proprii, în conformitate cu politicile lor de confidențialitate.</p>

            <h3>5. Consimțământul dumneavoastră</h3>
            <p>La prima vizită pe platformă, vi se solicită acordul printr-un banner de cookie-uri.</p>
            <p>Aveți următoarele opțiuni:</p>
            <ul>
                <li>Acceptă tot</li>
                <li>Doar necesare</li>
            </ul>
            <p>Preferința dumneavoastră este salvată și poate fi modificată ulterior prin setările browserului sau prin ștergerea cookie-urilor.</p>

            <h3>6. Cum puteți controla cookie-urile</h3>
            <p>Puteți:</p>
            <ul>
                <li>șterge cookie-urile existente;</li>
                <li>bloca cookie-urile viitoare;</li>
                <li>seta notificări privind utilizarea cookie-urilor,</li>
            </ul>
            <p>direct din setările browserului dumneavoastră.</p>
            <p>Rețineți că dezactivarea cookie-urilor strict necesare poate afecta funcționarea platformei.</p>

            <h3>7. Protecția datelor</h3>
            <p>Cookie-urile utilizate nu colectează informații care să vă identifice direct și sunt gestionate conform Politicii de Confidențialitate a platformei.</p>

            <h3>8. Modificarea politicii</h3>
            <p>Această Politică de Cookies poate fi actualizată periodic.</p>
            <p>Orice modificare va fi publicată pe această pagină, cu actualizarea datei.</p>

            <h3>9. Contact</h3>
            <p>Pentru întrebări legate de utilizarea cookie-urilor, ne puteți contacta la:<br />
                📧 <a href="mailto:contact@visuripehartie.ro">contact@visuripehartie.ro</a></p>
        </>
    )
}
