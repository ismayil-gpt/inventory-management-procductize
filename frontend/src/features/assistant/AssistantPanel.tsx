import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Drawer } from '../../design-system/drawer/Drawer';
import { useAssistantUi } from './assistant.store';
import { queryAssistant, ApiError, type AssistantSource } from '../../api-client/client';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  isDevelopmentModel?: boolean;
  sources?: AssistantSource[];
}

const SUGGESTED_QUESTION_KEYS = ['assistant.suggestLow', 'assistant.suggestPending', 'assistant.suggestCoffee'] as const;

/** Shows a source's own figures (stock, reorder point, quantity…) — the numbers the answer was built from. */
function sourceFigures(value: unknown): Array<[string, string]> {
  if (value === null || typeof value !== 'object') return value === undefined ? [] : [['', String(value)]];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
    .slice(0, 4)
    .map(([k, v]) => [k, String(v)]);
}

// §8.4 — a plain question/answer panel. No chat-bubble/rounded-pill styling (§9.2):
// hairline-separated turns, tokens only, consistent with the rest of the app.
export function AssistantPanel() {
  const { t } = useTranslation();
  const isOpen = useAssistantUi((s) => s.isOpen);
  const close = useAssistantUi((s) => s.close);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  if (!isOpen) return null;

  const language = (document.documentElement.getAttribute('lang') as 'en' | 'ar') ?? 'en';

  const send = async (asked?: string) => {
    const text = (asked ?? draft).trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const result = await queryAssistant(text, language);
      setMessages((m) => [...m, { role: 'assistant', text: result.answer, isDevelopmentModel: result.isDevelopmentModel, sources: result.sources }]);
    } catch (err) {
      setError(err instanceof ApiError ? (language === 'ar' ? err.body.messageAr : err.body.messageEn) ?? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title={t('assistant.title')} onClose={close}>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* The promise that sets this assistant apart: it phrases real data, never invents it (§8.4). */}
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--gantry)', border: 'none', boxShadow: 'var(--clay-gantry)', color: 'var(--gantry-ink)' }}>
              <div style={{ fontWeight: 600 }}>{t('assistant.neverGuessesTitle')}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gantry-muted)', marginTop: '2px' }}>{t('assistant.neverGuessesBody')}</div>
            </div>
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('assistant.emptyState')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SUGGESTED_QUESTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void send(t(key))}
                  disabled={busy}
                  style={{ textAlign: 'start', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--clay-raised-sm)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ borderTop: i > 0 ? '1px solid var(--hairline)' : undefined, paddingTop: i > 0 ? 'var(--space-3)' : 0 }}>
            <div style={{ fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', color: 'var(--ink-faint)', marginBottom: '4px' }}>
              {m.role === 'user' ? t('assistant.you') : t('app.name')}
              {m.isDevelopmentModel && (
                <span style={{ marginInlineStart: '8px', color: 'var(--warn)' }}>· {t('app.developmentModelBadge')}</span>
              )}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: 1.5 }}>{m.text}</div>
            {m.sources && m.sources.length > 0 && (
              <details style={{ marginTop: 'var(--space-2)' }}>
                <summary style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--primary-ink)' }}>
                  {t('assistant.sourcesSummary', { count: m.sources.length })}
                </summary>
                <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {m.sources.slice(0, 12).map((source) => (
                    <li key={`${source.type}-${source.id}`} style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', fontSize: 'var(--text-xs)' }}>
                      <div dir="ltr" style={{ fontWeight: 600, textAlign: 'start' }}>{source.label}</div>
                      <div dir="ltr" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: '2px', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                        {sourceFigures(source.value).map(([key, value]) => (
                          <span key={key}>{key ? `${key}: ` : ''}<span style={{ color: 'var(--ink)' }}>{value}</span></span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
        {busy && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{t('assistant.thinking')}</div>}
        {error && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--critical)' }}>{error}</div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-4)', borderTop: '1px solid var(--hairline)' }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('assistant.placeholder')}
          disabled={busy}
          style={{
            flex: 1,
            height: '36px',
            padding: '0 var(--space-3)',
            border: 'none', boxShadow: 'var(--clay-pressed)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-sunken)',
            color: 'var(--ink)',
            fontSize: 'var(--text-sm)',
          }}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label={t('assistant.send')}
          style={{
            width: '36px',
            height: '36px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            border: 'none', boxShadow: 'var(--clay-tinted)',
            background: 'var(--primary)',
            color: 'var(--on-primary)',
            cursor: busy || !draft.trim() ? 'default' : 'pointer',
            opacity: busy || !draft.trim() ? 0.5 : 1,
          }}
        >
          <Send size={16} strokeWidth={1.5} />
        </button>
      </form>
    </Drawer>
  );
}
