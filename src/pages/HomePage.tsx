import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';

const IconZap = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const IconStar = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconHome = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconSpark = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);
const IconBox = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);
const IconOffice = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>
);

interface ServiceCard {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag?: string;
}

export function HomePage() {
  const { t, navigateTo } = useLanguage();
  const { user, isClient, isCleaner } = useAuth();
  const loggedIn = Boolean(user);
  const canReserveFromHome = !loggedIn || isClient();
  const canBecomeCleanerFromHome = !loggedIn;

  const goToReservation = () => {
    if (!user) {
      navigateTo('login');
      return;
    }
    if (isClient()) {
      navigateTo('clientReservation');
      return;
    }
    if (isCleaner()) {
      return;
    }
  };
  const goToSignup = () => {
    if (!user) {
      navigateTo('signup');
      return;
    }
  };

  const services: ServiceCard[] = [
    { icon: <IconHome />, title: t.home.servicesSection.residentialTitle, desc: t.home.servicesSection.residentialDesc },
    { icon: <IconSpark />, title: t.home.servicesSection.deepTitle, desc: t.home.servicesSection.deepDesc, tag: t.home.servicesSection.deepTag },
    { icon: <IconBox />, title: t.home.servicesSection.movingTitle, desc: t.home.servicesSection.movingDesc },
    { icon: <IconOffice />, title: t.home.servicesSection.officeTitle, desc: t.home.servicesSection.officeDesc }
  ];

  const steps = [
    { num: '01', title: t.home.steps.step1Title, desc: t.home.steps.step1Desc },
    { num: '02', title: t.home.steps.step2Title, desc: t.home.steps.step2Desc },
    { num: '03', title: t.home.steps.step3Title, desc: t.home.steps.step3Desc }
  ];

  const trust = [
    { icon: <IconZap />, title: t.home.trust.fastTitle, desc: t.home.trust.fastDesc },
    { icon: <IconStar />, title: t.home.trust.transparentTitle, desc: t.home.trust.transparentDesc }
  ];

  return (
    <main style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: '#1A1A2E', overflowX: 'hidden' }}>
      <section style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #f0fbff 0%, #e8faf3 55%, #f8fffc 100%)',
        padding: 'clamp(72px, 12vw, 120px) 24px clamp(80px, 14vw, 140px)',
        textAlign: 'center',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px', width: '380px', height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,195,247,0.18) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px', width: '300px', height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,230,207,0.22) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', maxWidth: '680px', margin: '0 auto' }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(79,195,247,0.12)',
            color: '#0288D1',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '6px 16px',
            borderRadius: '100px',
            marginBottom: '28px',
            border: '1px solid rgba(79,195,247,0.25)'
          }}>
            {t.home.hero.badge}
          </span>

          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: '20px',
            color: '#0D1117'
          }}>
            {t.home.hero.titlePrefix}{' '}
            <span style={{
              background: 'linear-gradient(90deg, #4FC3F7, #29B6F6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              {t.home.hero.titleHighlight}
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(16px, 2vw, 20px)',
            color: '#4A5568',
            lineHeight: 1.65,
            marginBottom: '40px',
            maxWidth: '560px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            {t.home.hero.subtitle}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={goToReservation}
              disabled={!canReserveFromHome}
              aria-disabled={!canReserveFromHome}
              style={{
                background: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '17px',
                padding: '16px 40px',
                borderRadius: '14px',
                border: 'none',
                cursor: canReserveFromHome ? 'pointer' : 'not-allowed',
                opacity: canReserveFromHome ? 1 : 0.55,
                boxShadow: '0 8px 32px rgba(79,195,247,0.45)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                letterSpacing: '0.01em'
              }}
              onMouseEnter={(e) => {
                if (!canReserveFromHome) return;
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(79,195,247,0.55)';
              }}
              onMouseLeave={(e) => {
                if (!canReserveFromHome) return;
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(79,195,247,0.45)';
              }}
            >
              {t.home.hero.primaryCta}
            </button>
            <button
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                background: 'transparent',
                color: '#1A1A2E',
                fontWeight: 600,
                fontSize: '16px',
                padding: '16px 28px',
                borderRadius: '14px',
                border: '1.5px solid rgba(26,26,46,0.15)',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = '#4FC3F7'}
              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(26,26,46,0.15)'}
            >
              {t.home.hero.secondaryCta}
            </button>
          </div>

        </div>
      </section>

      <section style={{
        background: '#fff',
        padding: 'clamp(60px, 8vw, 96px) 24px'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', fontSize: 'clamp(22px, 3.5vw, 34px)',
            fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.015em'
          }}>
            {t.home.trust.title}
          </h2>
          <p style={{ textAlign: 'center', color: '#718096', marginBottom: '52px', fontSize: '16px' }}>
            {t.home.trust.subtitle}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px'
          }}>
            {trust.map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: '#FAFAFA',
                border: '1px solid #F0F0F0',
                borderRadius: '20px',
                padding: '32px 28px',
                transition: 'box-shadow 0.2s ease'
              }}
                onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(79,195,247,0.12)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}
              >
                <div style={{
                  color: '#4FC3F7', marginBottom: '16px',
                  background: 'rgba(79,195,247,0.1)', display: 'inline-flex',
                  padding: '10px', borderRadius: '12px'
                }}>{icon}</div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>{title}</h3>
                <p style={{ color: '#718096', fontSize: '15px', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{
        background: 'linear-gradient(135deg, #f0fbff 0%, #edf9f4 100%)',
        padding: 'clamp(60px, 8vw, 96px) 24px'
      }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', fontSize: 'clamp(22px, 3.5vw, 34px)',
            fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.015em'
          }}>
            {t.home.steps.title}
          </h2>
          <p style={{ textAlign: 'center', color: '#718096', marginBottom: '56px', fontSize: '16px' }}>
            {t.home.steps.subtitle}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px'
          }}>
            {steps.map(({ num, title, desc }) => (
              <div key={num} style={{ position: 'relative', textAlign: 'center', padding: '36px 24px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4FC3F7, #A8E6CF)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 8px 24px rgba(79,195,247,0.3)'
                }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>{num}</span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>{title}</h3>
                <p style={{ color: '#718096', fontSize: '15px', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <button
              onClick={goToReservation}
              disabled={!canReserveFromHome}
              aria-disabled={!canReserveFromHome}
              style={{
                background: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '16px',
                padding: '15px 36px',
                borderRadius: '14px',
                border: 'none',
                cursor: canReserveFromHome ? 'pointer' : 'not-allowed',
                opacity: canReserveFromHome ? 1 : 0.55,
                boxShadow: '0 6px 24px rgba(79,195,247,0.4)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!canReserveFromHome) return;
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                if (!canReserveFromHome) return;
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              {t.home.steps.cta}
            </button>
          </div>
        </div>
      </section>

      <section style={{
        background: '#fff',
        padding: 'clamp(60px, 8vw, 96px) 24px'
      }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', fontSize: 'clamp(22px, 3.5vw, 34px)',
            fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.015em'
          }}>
            {t.home.servicesSection.title}
          </h2>
          <p style={{ textAlign: 'center', color: '#718096', marginBottom: '52px', fontSize: '16px' }}>
            {t.home.servicesSection.subtitle}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '20px'
          }}>
            {services.map(({ icon, title, desc, tag }) => (
              <button
                key={title}
                onClick={goToReservation}
                disabled={!canReserveFromHome}
                aria-disabled={!canReserveFromHome}
                style={{
                  background: '#fff',
                  border: '1.5px solid #EAEAEA',
                  borderRadius: '20px',
                  padding: '28px 22px',
                  cursor: canReserveFromHome ? 'pointer' : 'not-allowed',
                  opacity: canReserveFromHome ? 1 : 0.65,
                  textAlign: 'left',
                  position: 'relative',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!canReserveFromHome) return;
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = '#4FC3F7';
                  el.style.boxShadow = '0 8px 32px rgba(79,195,247,0.12)';
                  el.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  if (!canReserveFromHome) return;
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = '#EAEAEA';
                  el.style.boxShadow = 'none';
                  el.style.transform = 'translateY(0)';
                }}
              >
                {tag && (
                  <span style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: 'rgba(168,230,207,0.3)',
                    color: '#2E7D52',
                    fontSize: '11px', fontWeight: 700,
                    padding: '3px 10px', borderRadius: '100px',
                    letterSpacing: '0.04em', textTransform: 'uppercase'
                  }}>{tag}</span>
                )}
                <div style={{ color: '#4FC3F7', marginBottom: '16px' }}>{icon}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: '#1A1A2E' }}>{title}</h3>
                <p style={{ color: '#718096', fontSize: '14px', lineHeight: 1.55 }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #0D1117 100%)',
        padding: 'clamp(64px, 10vw, 112px) 24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '-120px', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,195,247,0.1) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />
        <div style={{ position: 'relative', maxWidth: '620px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(26px, 4.5vw, 46px)',
            fontWeight: 800, color: '#fff',
            lineHeight: 1.15, letterSpacing: '-0.02em',
            marginBottom: '16px'
          }}>
            {t.home.finalCta.titlePrefix}{' '}
            <span style={{ color: '#4FC3F7' }}>{t.home.finalCta.titleHighlight}</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '17px', marginBottom: '40px', lineHeight: 1.6 }}>
            {t.home.finalCta.subtitle}
          </p>
          <button
            onClick={goToReservation}
            disabled={!canReserveFromHome}
            aria-disabled={!canReserveFromHome}
            style={{
              background: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '17px',
              padding: '17px 44px',
              borderRadius: '14px',
              border: 'none',
              cursor: canReserveFromHome ? 'pointer' : 'not-allowed',
              opacity: canReserveFromHome ? 1 : 0.55,
              boxShadow: '0 8px 40px rgba(79,195,247,0.35)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!canReserveFromHome) return;
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 14px 48px rgba(79,195,247,0.5)';
            }}
            onMouseLeave={(e) => {
              if (!canReserveFromHome) return;
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 40px rgba(79,195,247,0.35)';
            }}
          >
            {t.home.finalCta.cta}
          </button>
        </div>
      </section>

      <section style={{
        background: '#FAFAFA',
        padding: 'clamp(48px, 6vw, 72px) 24px',
        borderTop: '1px solid #F0F0F0',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '580px', margin: '0 auto' }}>
          <p style={{ color: '#4FC3F7', fontWeight: 600, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            {t.home.cleanerCta.eyebrow}
          </p>
          <h3 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.01em' }}>
            {t.home.cleanerCta.title}
          </h3>
          <p style={{ color: '#718096', fontSize: '15px', marginBottom: '28px', lineHeight: 1.65 }}>
            {t.home.cleanerCta.subtitle}
          </p>
          <button
            onClick={goToSignup}
            disabled={!canBecomeCleanerFromHome}
            aria-disabled={!canBecomeCleanerFromHome}
            style={{
              background: 'transparent',
              color: '#1A1A2E',
              fontWeight: 600,
              fontSize: '15px',
              padding: '13px 28px',
              borderRadius: '12px',
              border: '1.5px solid rgba(26,26,46,0.2)',
              cursor: canBecomeCleanerFromHome ? 'pointer' : 'not-allowed',
              opacity: canBecomeCleanerFromHome ? 1 : 0.55,
              transition: 'border-color 0.15s ease, background 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!canBecomeCleanerFromHome) return;
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = '#4FC3F7';
              el.style.background = 'rgba(79,195,247,0.05)';
            }}
            onMouseLeave={(e) => {
              if (!canBecomeCleanerFromHome) return;
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = 'rgba(26,26,46,0.2)';
              el.style.background = 'transparent';
            }}
          >
            {t.home.cleanerCta.cta}
          </button>
        </div>
      </section>
    </main>
  );
}
