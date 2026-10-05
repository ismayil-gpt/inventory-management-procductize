import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Database, ChevronDown, RotateCcw, TrendingDown, ClipboardCheck, Coffee, type LucideIcon } from 'lucide-react';
import { Drawer } from '../../design-system/drawer/Drawer';
import { MizanMark } from '../../design-system/brand-mark/MizanMark';
import { StockStatusIndicator } from '../../design-system/stock-status-indicator/StockStatusIndicator';
import { useAssistantUi } from './assistant.store';
import { queryAssistant, ApiError, type AssistantSource, type StockStatus } from '../../api-client/client';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  isDevelopmentModel?: boolean;
  sources?: AssistantSource[];
}

const SUGGESTIONS: Array<{ key: string; Icon: LucideIcon }> = [
  { key: 'assistant.suggestLow', Icon: TrendingDown },
  { key: 'assistant.suggestPending', Icon: ClipboardCheck },
  { key: 'assistant.suggestCoffee', Icon: Coffee },
];

const STOCK_STATUSES: readonly string[] = ['IN_STOCK', 'LOW', 'CRITICAL', 'OUT'];
// Source fields the ai-service sends (see ai-service/src/assistant/api.py) with a readable label.
const KNOWN_FIGURES = ['totalStock', 'reorderPoint', 'status', 'suggestedQty', 'reasonCode', 'quantity', 'type'];

/** A source's own figures (stock, reorder point, quantity…): the numbers the answer was built from. */
function sourceFigures(value: unknown): Array<[string, string]> {
  if (value === null || typeof value !== 'object') return value === undefined ? [] : [['', String(value)]];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
    .slice(0, 4)
    .map(([k, v]) => [k, String(v)]);
}

// §8.4 — question and answer, clay edition: the question sits on the reading-end
// side, Mizan's answer is a raised card that carries the records it was built
// from, so every figure can be traced to a row.
export function AssistantPanel() {
  const { t } = useTranslation();
  const isOpen = useAssistantUi((s) => s.isOpen);
  const close = useAssistantUi((s) => s.close);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy, error]);

  if (!isOpen) return null;

  const language = (document.documentElement.getAttribute('lang') as 'en' | 'ar') ?? 'en';

  const send = async (asked?: string, isRetry = false) => {
    const text = (asked ?? draft).trim();
    if (!text || busy) return;
    if (!isRetry) setMessages((m) => [...m, { role: 'user', text }]);
    setLastQuestion(text);
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
      inputRef.current?.focus();
    }
  };

  const startOver = () => {
    setMessages([]);
    setError(null);
    setLastQuestion('');
    inputRef.current?.focus();
  };

  const canSend = !busy && draft.trim().length > 0;
  const card: React.CSSProperties = { alignSelf: 'stretch', background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--clay-raised-sm)', padding: 'var(--space-3) var(--space-4)' };
  // Who is speaking, with the development-model tag beside the name (§2.2; never in production builds).
  const speaker = (isDevelopmentModel?: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <MizanMark size={20} />
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink)' }}>{t('app.name')}</span>
      {isDevelopmentModel && (
        <span style={{ padding: '1px 8px', borderRadius: 'var(--radius-chip)', background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 'var(--text-2xs)', fontWeight: 600 }}>
          {t('app.developmentModelBadge')}
        </span>
      )}
    </div>
  );

  return (
    <Drawer
      title={t('assistant.title')}
      subtitle={t('assistant.subtitle')}
      icon={<MizanMark size={36} />}
      headerActions={messages.length > 0 && (
        <button
          type="button"
          onClick={startOver}
          aria-label={t('assistant.clear')}
          title={t('assistant.clear')}
          style={{ width: '36px', height: '36px', display: 'inline-grid', placeItems: 'center', flex: 'none', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--surface)', boxShadow: 'var(--clay-raised-sm)', color: 'var(--ink-muted)', cursor: 'pointer' }}
        >
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden />
        </button>
      )}
      onClose={close}
    >
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        className="shell-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3) var(--space-5) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        {messages.length === 0 && (
          <>
            {/* The promise that sets this assistant apart: it phrases real data, never invents it (§8.4). */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--gantry)', boxShadow: 'var(--clay-gantry)', color: 'var(--gantry-ink)' }}>
              <Database size={20} strokeWidth={1.5} aria-hidden style={{ flex: 'none', color: 'var(--sign)', marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t('assistant.neverGuessesTitle')}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gantry-muted)', marginTop: '4px' }}>{t('assistant.neverGuessesBody')}</div>
              </div>
            </div>
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('assistant.emptyState')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {SUGGESTIONS.map(({ key, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void send(t(key))}
                  disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: '44px', textAlign: 'start', padding: '0 var(--space-4)', borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--clay-raised-sm)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
                >
                  <Icon size={16} strokeWidth={1.5} aria-hidden style={{ flex: 'none', color: 'var(--primary-ink)' }} />
                  {t(key)}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={i}
              style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '10px var(--space-4)', borderRadius: 'var(--radius-md)', borderEndEndRadius: 'var(--radius-dot)', background: 'var(--primary-soft)', boxShadow: 'var(--clay-raised-sm)', color: 'var(--ink)', fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}
            >
              <span className="sr-only">{t('assistant.you')}: </span>
              {/* Direction follows the text itself: an English question stays LTR in the Arabic UI. */}
              <bdi dir="auto">{m.text}</bdi>
            </div>
          ) : (
            <div key={i} style={card}>
              {speaker(m.isDevelopmentModel)}
              <div dir="auto" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', textAlign: 'start' }}>{m.text}</div>
              {m.sources && m.sources.length > 0 && (
                <details className="assistant-sources" style={{ marginTop: 'var(--space-3)' }}>
                  <summary style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '32px', padding: '0 var(--space-3)', borderRadius: 'var(--radius-chip)', background: 'var(--surface-sunken)', boxShadow: 'var(--clay-pressed)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--primary-ink)', listStyle: 'none' }}>
                    <Database size={13} strokeWidth={1.75} aria-hidden />
                    {t('assistant.sourcesSummary', { count: m.sources.length })}
                    <ChevronDown size={14} strokeWidth={1.75} aria-hidden className="assistant-sources-chevron" />
                  </summary>
                  <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {m.sources.slice(0, 12).map((source) => (
                      <li key={`${source.type}-${source.id}`} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', fontSize: 'var(--text-xs)' }}>
                        <bdi style={{ display: 'block', fontWeight: 600, color: 'var(--ink)' }}>{source.label}</bdi>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: '4px', color: 'var(--ink-muted)' }}>
                          {sourceFigures(source.value).map(([key, value]) => (
                            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {key && <span>{KNOWN_FIGURES.includes(key) ? t(`assistant.figure.${key}`) : key}</span>}
                              {key === 'status' && STOCK_STATUSES.includes(value)
                                ? <StockStatusIndicator status={value as StockStatus} />
                                : <bdi className="tabular" style={{ color: 'var(--ink)', fontWeight: 600 }}>{value}</bdi>}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ),
        )}

        {busy && (
          <div role="status" style={{ ...card, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>
            <span className="assistant-dots" aria-hidden><i /><i /><i /></span>
            {t('assistant.lookingUp')}
          </div>
        )}
        {error && (
          <div role="alert" style={{ ...card, background: 'var(--critical-soft)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--critical)' }}>{error}</span>
            {lastQuestion && (
              <button
                type="button"
                onClick={() => void send(lastQuestion, true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 var(--space-4)', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--surface)', boxShadow: 'var(--clay-raised-sm)', color: 'var(--ink)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}
              >
                <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
                {t('assistant.retry')}
              </button>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        style={{ padding: 'var(--space-3) var(--space-4) var(--space-4)', borderTop: '1px solid var(--hairline)' }}
      >
        {/* One pressed-in well holds the field and the send button; the focus ring circles the whole well. */}
        <div className="focus-ring-within" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '4px 4px 4px var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', boxShadow: 'var(--clay-pressed)' }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('assistant.placeholder')}
            aria-label={t('assistant.placeholder')}
            disabled={busy}
            style={{ flex: 1, minWidth: 0, height: '40px', border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 'var(--text-sm)' }}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label={t('assistant.send')}
            title={t('assistant.send')}
            style={{
              width: '40px', height: '40px', flex: 'none', display: 'inline-grid', placeItems: 'center',
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: canSend ? 'var(--primary)' : 'transparent',
              boxShadow: canSend ? 'var(--clay-tinted)' : 'none',
              color: canSend ? 'var(--on-primary)' : 'var(--ink-faint)',
              cursor: canSend ? 'pointer' : 'default',
            }}
          >
            {/* The paper plane points along the reading direction. */}
            <Send size={17} strokeWidth={1.75} aria-hidden style={{ transform: language === 'ar' ? 'scaleX(-1)' : undefined }} />
          </button>
        </div>
      </form>
    </Drawer>
  );
}
