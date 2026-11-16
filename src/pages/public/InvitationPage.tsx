import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { applyTheme, monogram } from '../../lib/theme';
import { eventNotes, eventTitle, fmtLongDate, fmtTime, joinNames, TZ } from '../../lib/format';
import { downloadIcs, googleCalendarUrl } from '../../lib/ics';
import { invitationUrl, whatsappUrl } from '../../lib/share';
import { addressForm, genderOf, invitationName, peopleLabel, personLabel } from '../../lib/people';
import type { Lang, PublicInvitation, RsvpStatus, TemplateId } from '../../lib/types';
import { Bow, Leaves } from '../../components/Ornament';
import CardExport from '../../components/CardExport';

type Answers = Record<string, RsvpStatus>;
const key = (g: string, e: string) => `${g}:${e}`;
const todayDouala = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function InvitationPage() {
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const templateOverride = params.get('template') as TemplateId | null;
  const { t, i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';

  const [data, setData] = useState<PublicInvitation | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [celebrate, setCelebrate] = useState(0);
  const cardRef = useReveal(opened);

  useEffect(() => {
    (async () => {
      const { data: res, error } = await supabase.rpc('get_invitation', { p_token: token, p_track: !preview });
      if (error || !res) {
        setState('notfound');
        return;
      }
      const d = res as PublicInvitation;
      setData(d);
      applyTheme(d.settings.theme);
      i18n.changeLanguage(localStorage.getItem('invite-lang') || d.invitation.language);
      const initial: Answers = {};
      d.guests.forEach((g) => g.rsvps?.forEach((r) => (initial[key(g.id, r.event_id)] = r.status)));
      setAnswers(initial);
      setState('ok');
    })();
  }, [token, preview, i18n]);

  const toggleLang = () => {
    const next = lang === 'fr' ? 'en' : 'fr';
    localStorage.setItem('invite-lang', next);
    i18n.changeLanguage(next);
  };

  if (state === 'loading') return <div className="invite tpl-marine invite--center"><p className="invite__loading">{t('loading')}</p></div>;
  if (state === 'notfound' || !data) {
    return (
      <div className="invite tpl-ivoire invite--center">
        <div className="notfound">
          <h1>{t('notFound.title')}</h1>
          <p>{t('notFound.body')}</p>
        </div>
      </div>
    );
  }

  const tpl = templateOverride || data.invitation.template;
  const couple = data.settings.couple_names;
  const names = joinNames(data.guests.map((g) => g.full_name), lang);
  const hasCustomName = Boolean(data.invitation.household_name?.trim());

  const open = () => {
    setOpening(true);
    setTimeout(() => setOpened(true), reducedMotion() ? 0 : 950);
  };

  // Après l'envoi : fête (si quelqu'un vient sur place) puis défilement jusqu'au pass.
  const onSaved = (saved: Answers) => {
    const values = Object.values(saved);
    if (values.includes('yes') && !reducedMotion()) setCelebrate((n) => n + 1);
    if (values.includes('yes') || values.includes('remote')) {
      requestAnimationFrame(() =>
        document.getElementById('pass')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }),
      );
    }
  };

  return (
    <div className={`invite tpl-${tpl}`} lang={lang}>
      <button className="lang-switch" onClick={toggleLang}>{t('lang')}</button>
      {!opened ? (
        <section className={`envelope-stage ${opening ? 'is-opening' : ''}`}>
          <div className="envelope">
            <div className="envelope__pocket" aria-hidden="true" />
            <div className="envelope__flap" aria-hidden="true">
              <div className="envelope__flap-paper" />
            </div>
            <button className="seal" onClick={open} aria-label={t('envelope.open')}>
              <span className="seal__mono">{monogram(couple)}</span>
            </button>
            <div className="envelope__address">
              <p className="envelope__for">{t('envelope.for')}</p>
              <p className="envelope__names">{invitationName({ ...data.invitation, guests: data.guests }, lang)}</p>
              {hasCustomName && <p className="envelope__members">{peopleLabel(data.guests, lang)}</p>}
            </div>
          </div>
          <p className="envelope__hint" aria-hidden="true">{t('envelope.open')}</p>
        </section>
      ) : (
        <main className="card" ref={cardRef}>
          <Hero data={data} lang={lang} />
          <Greeting data={data} lang={lang} names={names} />
          <Program data={data} lang={lang} />
          <RsvpForm data={data} token={token} lang={lang} answers={answers} setAnswers={setAnswers} preview={preview} onSaved={onSaved} />
          <Pass data={data} token={token} answers={answers} lang={lang} pop={celebrate} />
          <section className="keep" data-reveal>
            <h2>{t('card.title')}</h2>
            <p className="pass__hint">{t('card.intro')}</p>
            <CardExport
              card={{
                lang,
                template: tpl,
                theme: data.settings.theme,
                couple,
                weddingDate: data.settings.wedding_date,
                rsvpDeadline: data.settings.rsvp_deadline,
                invitees: invitationName({ ...data.invitation, guests: data.guests }, lang),
                events: data.events,
                url: invitationUrl(token),
              }}
              labels={{ pdf: t('card.pdf'), image: t('card.image'), working: t('card.working'), error: t('card.error') }}
              filename={`invitation-${couple.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}`}
              buttonClass="btn-invite btn-invite--ghost"
            />
          </section>
          {data.settings.contact_phone && (
            <footer className="contact">
              <p>{t('contact.question')}</p>
              <a className="btn-invite btn-invite--ghost" href={whatsappUrl(data.settings.contact_phone, '')} target="_blank" rel="noreferrer">
                {t('contact.write')}
              </a>
            </footer>
          )}
        </main>
      )}
      {celebrate > 0 && <Celebration key={celebrate} />}
    </div>
  );
}

/**
 * Apparition au défilement : les éléments [data-reveal] de la carte reçoivent .is-visible
 * quand ils entrent à l'écran. Sans IntersectionObserver, tout est affiché d'emblée.
 */
function useReveal(active: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    root.classList.add('reveal-on');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            io.unobserve(en.target);
          }
        }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [active]);
  return ref;
}

/** Pluie de petits nœuds dorés, le motif du mariage (≈ 1,6 s). */
function Celebration() {
  const [done, setDone] = useState(false);
  const bows = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        delay: `${(i % 7) * 0.09}s`,
        drift: `${((i * 53) % 120) - 60}px`,
        spin: `${((i * 97) % 540) - 270}deg`,
        size: 16 + ((i * 13) % 14),
      })),
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 2600);
    return () => clearTimeout(timer);
  }, []);
  if (done) return null;
  return (
    <div className="celebration" aria-hidden="true">
      {bows.map((b, i) => (
        <span
          key={i}
          className="celebration__bow"
          style={{ left: b.left, animationDelay: b.delay, '--drift': b.drift, '--spin': b.spin } as CSSProperties}
        >
          <Bow size={b.size} />
        </span>
      ))}
    </div>
  );
}

function Hero({ data, lang }: { data: PublicInvitation; lang: Lang }) {
  const { t } = useTranslation();
  const date = data.settings.wedding_date;
  let countdown = '';
  if (date) {
    const days = Math.round((Date.parse(date) - Date.parse(todayDouala())) / 86400000);
    countdown = days > 0 ? t('hero.days', { count: days }) : days === 0 ? t('hero.today') : t('hero.past');
  }
  const [a, b] = data.settings.couple_names.split('&').map((s) => s.trim());
  return (
    <header className="hero">
      {data.invitation.template === 'jardin' && <Leaves className="hero__leaves" />}
      <h1 className="hero__names" aria-label={data.settings.couple_names}>
        <Letters text={a} from={0} />
        {b && <span className="hero__amp" aria-hidden="true" style={{ '--i': a.length + 1 } as CSSProperties}>&amp;</span>}
        {b && <Letters text={b} from={a.length + 3} />}
      </h1>
      <p className="hero__invite hero__after">{t('hero.invite')}</p>
      <p className="hero__date hero__after">{fmtLongDate(date, lang)}</p>
      {countdown && <p className="hero__countdown hero__after">{countdown}</p>}
    </header>
  );
}

/** Prénoms écrits lettre par lettre (décalage --i par lettre). */
function Letters({ text, from }: { text: string; from: number }) {
  return (
    <span className="hero__line" aria-hidden="true">
      {Array.from(text).map((ch, i) => (
        <span key={i} className="hero__letter" style={{ '--i': from + i } as CSSProperties}>
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      ))}
    </span>
  );
}

function Greeting({ data, lang, names }: { data: PublicInvitation; lang: Lang; names: string }) {
  const { t } = useTranslation();
  const welcome = lang === 'en' ? data.settings.welcome_en : data.settings.welcome_fr;
  return (
    <section className="greeting" data-reveal>
      <Bow className="greeting__bow" />
      <p className="greeting__dear">
        {t(`dear.${addressForm(data.guests)}`)} {names},
      </p>
      {welcome && <p>{welcome}</p>}
      {data.invitation.message && <p className="greeting__personal">{data.invitation.message}</p>}
    </section>
  );
}

function Program({ data, lang }: { data: PublicInvitation; lang: Lang }) {
  const { t } = useTranslation();
  const couple = data.settings.couple_names;
  return (
    <section className="program">
      <h2 data-reveal>{t('program.title')}</h2>
      <ol className="timeline">
        {data.events.map((e, i) => (
          <li key={e.id} className="timeline__item" data-reveal style={{ '--i': i } as CSSProperties}>
            <time className="timeline__time">{fmtTime(e.starts_at, lang)}</time>
            <div className="timeline__body">
              <h3>{eventTitle(e, lang)}</h3>
              {e.venue_name && <p className="timeline__venue">{e.venue_name}</p>}
              {e.address && <p className="timeline__address">{e.address}</p>}
              {eventNotes(e, lang) && <p className="timeline__notes">{eventNotes(e, lang)}</p>}
              <div className="timeline__links">
                {e.stream_url && <a href={e.stream_url} target="_blank" rel="noreferrer">{t('program.stream')}</a>}
                {e.map_url && <a href={e.map_url} target="_blank" rel="noreferrer">{t('program.route')}</a>}
                <a href={googleCalendarUrl(e, lang, couple)} target="_blank" rel="noreferrer">{t('program.addGoogle')}</a>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button className="btn-invite btn-invite--ghost" onClick={() => downloadIcs(data.events, lang, couple)}>
        {t('program.addAll')}
      </button>
    </section>
  );
}

function RsvpForm(props: {
  data: PublicInvitation;
  token: string;
  lang: Lang;
  answers: Answers;
  setAnswers: (a: Answers) => void;
  preview: boolean;
  onSaved: (a: Answers) => void;
}) {
  const { data, token, lang, answers, setAnswers, preview, onSaved } = props;
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Answers>(answers);
  const [status, setStatus] = useState<'idle' | 'sending' | 'saved' | 'previewSaved' | 'error' | 'incomplete'>('idle');
  const count = data.guests.length;
  const hasStream = data.events.some((e) => e.stream_url);
  const deadline = data.settings.rsvp_deadline;
  const closed = Boolean(deadline && todayDouala() > deadline);
  const alreadyAnswered = Object.keys(answers).length > 0;

  useEffect(() => setDraft(answers), [answers]);

  const total = data.guests.length * data.events.length;
  const done = useMemo(
    () => data.guests.reduce((n, g) => n + data.events.filter((e) => draft[key(g.id, e.id)]).length, 0),
    [draft, data],
  );
  const complete = done === total;

  const setOne = (g: string, e: string, v: RsvpStatus) => {
    setDraft({ ...draft, [key(g, e)]: v });
    setStatus('idle');
  };

  const allYes = () => {
    const next: Answers = {};
    data.guests.forEach((g) => data.events.forEach((e) => (next[key(g.id, e.id)] = 'yes')));
    setDraft(next);
    setStatus('idle');
  };

  const submit = async () => {
    if (!complete) return setStatus('incomplete');
    if (preview) {
      // En aperçu rien n'est enregistré, mais on montre le pass comme le verra l'invité.
      setAnswers(draft);
      setStatus('previewSaved');
      onSaved(draft);
      return;
    }
    setStatus('sending');
    const payload = Object.entries(draft).map(([k, status]) => {
      const [guest_id, event_id] = k.split(':');
      return { guest_id, event_id, status };
    });
    const { error } = await supabase.rpc('submit_rsvp', { p_token: token, p_answers: payload });
    if (error) return setStatus('error');
    setAnswers(draft);
    setStatus('saved');
    onSaved(draft);
  };

  return (
    <section className="rsvp" data-reveal>
      <h2>{t('rsvp.title')}</h2>
      {closed ? (
        <p className="rsvp__note">{t('rsvp.closed')}</p>
      ) : (
        <>
          <p>{t('rsvp.intro', { count })}</p>
          {hasStream && <p className="rsvp__note">{t('rsvp.remoteHint')}</p>}
          {deadline && <p className="rsvp__note">{t('rsvp.deadline', { date: fmtLongDate(deadline, lang) })}</p>}
          {data.guests.length * data.events.length > 1 && (
            <button className="link-btn" onClick={allYes}>{t('rsvp.allYes', { count })}</button>
          )}
          <div className="rsvp__guests">
            {data.guests.map((g) => (
              <fieldset key={g.id} className="rsvp__guest">
                <legend>
                  {personLabel(g, lang)} {g.is_child && <span className="tag">{t('rsvp.child')}</span>}
                </legend>
                {data.events.map((e) => {
                  const v = draft[key(g.id, e.id)];
                  const name = `r-${g.id}-${e.id}`;
                  const label = `${g.full_name} – ${eventTitle(e, lang)}`;
                  const choice = (value: RsvpStatus, text: string, icon: JSX.Element) => (
                    <label className={`choice choice--${value} ${v === value ? 'is-on' : ''}`}>
                      <input type="radio" name={name} checked={v === value} onChange={() => setOne(g.id, e.id, value)} />
                      {icon}
                      <span>{text}</span>
                    </label>
                  );
                  return (
                    <div key={e.id} className={`rsvp__row ${v ? '' : 'is-todo'}`}>
                      <p className="rsvp__event">
                        <span>{eventTitle(e, lang)}</span>
                        <span className="rsvp__time"> · {fmtTime(e.starts_at, lang)}</span>
                        {!v && <span className="rsvp__todo">{t('rsvp.todo')}</span>}
                      </p>
                      <div className="choices" role="radiogroup" aria-label={label}>
                        {choice('yes', t(`rsvp.yes_${genderOf(g)}`), <IconCheck />)}
                        {e.stream_url && choice('remote', t('rsvp.remote'), <IconScreen />)}
                        {choice('no', t(`rsvp.no_${genderOf(g)}`), <IconCross />)}
                      </div>
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </div>
          {total > 1 && (
            <p className={`rsvp__progress ${complete ? 'is-complete' : ''}`}>
              {complete ? t('rsvp.ready') : t('rsvp.progress', { done, total })}
            </p>
          )}
          <button className="btn-invite" onClick={submit} disabled={status === 'sending'}>
            {status === 'sending' ? t('rsvp.sending') : alreadyAnswered ? t('rsvp.update', { count }) : t('rsvp.submit', { count })}
          </button>
          <p className="rsvp__status" role="status" aria-live="polite">
            {status === 'saved' && t('rsvp.saved')}
            {status === 'previewSaved' && t('rsvp.previewSaved')}
            {status === 'incomplete' && t('rsvp.incomplete', { count })}
            {status === 'error' && t('rsvp.error')}
          </p>
        </>
      )}
    </section>
  );
}

const IconCheck = () => (
  <svg className="choice__icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
);
const IconCross = () => (
  <svg className="choice__icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
);
const IconScreen = () => (
  <svg className="choice__icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4.5h14v9H3zM7 16.5h6" /></svg>
);

function Pass(props: { data: PublicInvitation; token: string; answers: Answers; lang: Lang; pop: number }) {
  const { data, token, answers, lang, pop } = props;
  const { t } = useTranslation();
  const said = (g: string, v: RsvpStatus) => data.events.some((e) => answers[key(g, e.id)] === v);
  const onSite = data.guests.filter((g) => said(g.id, 'yes'));
  const online = data.guests.some((g) => said(g.id, 'remote'));
  const answered = Object.keys(answers).length > 0;
  const tables = Array.from(new Set(onSite.map((g) => g.table_label).filter(Boolean)));
  return (
    <section className="pass" id="pass" data-reveal>
      <h2>{t('pass.title')}</h2>
      {onSite.length > 0 ? (
        <>
          <div key={pop} className={`pass__qr ${pop ? 'pass__qr--pop' : ''}`}>
            <QRCodeSVG value={invitationUrl(token)} size={196} level="M" bgColor="#FFFFFF" fgColor="#121A33" marginSize={2} />
          </div>
          <p className="pass__household">{peopleLabel(onSite, lang)}</p>
          {tables.length > 0 && (
            <p className="pass__table">
              {t('pass.table')} {tables.join(', ')}
            </p>
          )}
          <p className="pass__hint">{t('pass.hint', { count: onSite.length })}</p>
          {online && <p className="pass__hint">{t('pass.remote')}</p>}
        </>
      ) : (
        <p className="pass__hint">{online ? t('pass.remote') : answered ? t('pass.declined') : t('pass.pending')}</p>
      )}
    </section>
  );
}
