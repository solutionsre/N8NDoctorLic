import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { npr } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { joinNames, useSettings } from '../SettingsContext.jsx';
import Icon from '../components/Icon.jsx';
import { FEATURE_GROUPS } from '../features.js';

export default function Home() {
  const info = useSettings();
  const { user } = useAuth();
  const { hash } = useLocation();

  useEffect(() => {
    const id = hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  const cta = user ? '/dashboard' : '/register';
  const { trialDays, plans, gateways } = info;
  const payWith = joinNames(gateways.map((g) => g.name));
  // "Best value" = the lowest price per day.
  const best = plans.reduce((b, p) => (!b || p.price / p.days < b.price / b.days ? p : b), null)?.id;

  const STEPS = [
    ['Create an account', 'Sign up and confirm your e-mail with a 6-digit code.'],
    ['Start the trial or buy', `Free for ${trialDays} days${payWith ? `, then pay with ${payWith}` : ''}.`],
    ['Paste the key in n8n Doctor', 'Give us your Machine ID, then paste the key into License Manager. Done.'],
  ];

  const FAQ = [
    ['What is a Machine ID?', 'A fingerprint of your computer shown in n8n Doctor under License Manager. Your key works only on that computer.'],
    ['Can I move a license to another computer?', 'Contact support with your new Machine ID and we will move it.'],
    ['Can I get the free trial again?', 'No. A trial is allowed once per account and once per machine.'],
    ['What happens when a license expires?', 'n8n Doctor locks until you renew. Your n8n data and backups are not touched.'],
    ...(payWith ? [['Is my payment safe?', `Payments go straight to ${payWith}. We never see your wallet PIN or card.`]] : []),
  ];

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="pill">
              <Icon name="bolt" size={14} /> Desktop app for n8n
            </span>
            <h1>
              Keep n8n healthy, <span className="accent">backed up and online.</span>
            </h1>
            <p className="lead">
              Buy a license for your computer and activate n8n Doctor in a minute: backups, monitoring and public URLs for your n8n instances.
            </p>
            <div className="row-actions">
              <Link to={cta} className="btn btn-primary btn-lg">
                {user ? 'Go to dashboard' : `Start ${trialDays}-day free trial`} <Icon name="arrowRight" />
              </Link>
              <a href="#pricing" className="btn btn-ghost btn-lg">
                See pricing
              </a>
            </div>
            <ul className="hero-ticks">
              <li>
                <Icon name="check" size={16} /> No payment for the trial
              </li>
              {payWith && (
                <li>
                  <Icon name="check" size={16} /> {joinNames(gateways.map((g) => g.name), '&')}
                </li>
              )}
              <li>
                <Icon name="check" size={16} /> Cancel any time
              </li>
            </ul>
          </div>

          {/* Live from the site settings: the trial, the plans on sale and the payment methods. */}
          <div className="preview">
            <div className="preview-body">
              <div className="preview-head">
                <strong>Plans at a glance</strong>
                <span className="badge good">{trialDays}-day free trial</span>
              </div>
              {plans.map((p) => (
                <div className="glance-row" key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <small>{p.days} days · 1 website</small>
                  </div>
                  <span className="glance-price">{npr(p.price)}</span>
                  {p.id === best && <span className="badge paid">Best value</span>}
                </div>
              ))}
              {plans.length === 0 && <p className="muted small">Plans will be published soon.</p>}
              {gateways.length > 0 && (
                <div className="preview-foot">
                  <Icon name="card" size={16} /> Pay with {payWith}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="container section">
        <div className="section-head">
          <p className="eyebrow">Features</p>
          <h2>Everything you need to look after n8n</h2>
          <p className="muted">Every feature is included in the free trial and in every plan.</p>
        </div>
        <div className="features">
          {FEATURE_GROUPS.map(({ icon, title, intro, items }) => (
            <div key={title} className="card feature">
              <span className="feature-icon">
                <Icon name={icon} size={22} />
              </span>
              <h3>{title}</h3>
              <p>{intro}</p>
              <ul className="feature-list">
                {items.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={15} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="section band">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2>Running in five minutes</h2>
          </div>
          <ol className="how">
            {STEPS.map(([t, d], i) => (
              <li key={t}>
                <span className="how-num">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pricing" className="container section">
        <div className="section-head">
          <p className="eyebrow">Pricing</p>
          <h2>Simple prices in rupees</h2>
          <p className="muted">{payWith && `Pay with ${payWith}. `}Each license key works on one computer.</p>
        </div>
        <div className="plans">
          <div className="card plan">
            <h3>Free trial</h3>
            <p className="price">
              {npr(0)} <small>/ {trialDays} days</small>
            </p>
            <ul>
              <li>
                <Icon name="check" size={16} /> Every feature included
              </li>
              <li>
                <Icon name="check" size={16} /> One trial per account and website
              </li>
              <li>
                <Icon name="check" size={16} /> No payment needed
              </li>
            </ul>
            <Link to={cta} className="btn btn-ghost btn-block">
              Start trial
            </Link>
          </div>
          {plans.map((p) => (
            <div key={p.id} className={`card plan ${p.id === best ? 'is-best' : ''}`}>
              {p.id === best && <span className="ribbon">Best value</span>}
              <h3>{p.name}</h3>
              <p className="price">
                {npr(p.price)} <small>/ {p.days} days</small>
              </p>
              <ul>
                <li>
                  <Icon name="check" size={16} /> 1 computer (Machine ID)
                </li>
                <li>
                  <Icon name="check" size={16} /> Works offline, e-mail expiry alerts
                </li>
                <li>
                  <Icon name="check" size={16} /> One-time {info.extendDays}-day extension near expiry
                </li>
                <li>
                  <Icon name="check" size={16} /> Instant key after payment
                </li>
              </ul>
              <Link to={cta} className={`btn btn-block ${p.id === best ? 'btn-primary' : 'btn-ghost'}`}>
                Buy {p.name.toLowerCase()}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="container section narrow">
        <div className="section-head">
          <p className="eyebrow">FAQ</p>
          <h2>Questions</h2>
        </div>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <div>
            <h2>Ready to automate your news desk?</h2>
            <p>Start the {trialDays}-day trial. It takes a minute.</p>
          </div>
          <Link to={cta} className="btn btn-light btn-lg">
            {user ? 'Go to dashboard' : 'Create free account'} <Icon name="arrowRight" />
          </Link>
        </div>
      </section>
    </>
  );
}
