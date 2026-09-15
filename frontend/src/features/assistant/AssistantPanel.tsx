import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Drawer } from '../../design-system/drawer/Drawer';
import { useAssistantUi } from './assistant.store';
import { queryAssistant, ApiError } from '../../api-client/client';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  isDevelopmentModel?: boolean;
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

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const result = await queryAssistant(text, language);
      setMessages((m) => [...m, { role: 'assistant', text: result.answer, isDevelopmentModel: result.isDevelopmentModel }]);
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
          <p style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('assistant.emptyState')}</p>
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
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
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
            border: 'none',
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
