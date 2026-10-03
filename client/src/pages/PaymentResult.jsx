import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

const TEXT = {
  success: ['Payment received', 'Your license is ready. Open your dashboard, copy the key (or download the .lic file) and paste it into n8n Doctor → License Manager.', 'checkCircle', 'good'],
  pending: ['Payment pending', 'The payment has not been confirmed yet.', 'clock', 'warn'],
  failed: ['Payment not completed', 'Nothing was charged for this order, or the payment could not be confirmed.', 'alert', 'bad'],
};

// Only messages the server really sends are shown, so a crafted link cannot
// put its own text (a fake phone number, say) on this page.
const KNOWN_MESSAGES = new Set([
  'Unknown payment.',
  'Khalti has not confirmed the payment yet. Refresh the dashboard in a few minutes.',
  'The eSewa answer could not be verified.',
  'eSewa has not confirmed the payment yet.',
  'The payment was cancelled or failed.',
]);
const GATEWAY_STATUS = /^(Khalti|eSewa): [A-Za-z][A-Za-z _-]{0,40}$/;

export default function PaymentResult() {
  const [params] = useSearchParams();
  const status = TEXT[params.get('status')] ? params.get('status') : 'failed';
  const [title, text, icon, tone] = TEXT[status];
  const raw = params.get('message') || '';
  const message = KNOWN_MESSAGES.has(raw) || GATEWAY_STATUS.test(raw) ? raw : '';
  const order = /^[0-9a-f-]{36}$/i.test(params.get('order') || '') ? params.get('order') : '';

  return (
    <section className="container page center-page">
      <div className={`card result result-${status}`}>
        <span className={`round-icon big ${tone}`}>
          <Icon name={icon} size={30} />
        </span>
        <h1>{title}</h1>
        <p>{text}</p>
        {message && <p className="muted">{message}</p>}
        {order && <p className="muted small">Order: <code>{order}</code></p>}
        <Link to="/dashboard" className="btn btn-primary">
          Go to dashboard
        </Link>
      </div>
    </section>
  );
}
