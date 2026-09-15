import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { useAssistantUi } from './assistant.store';

// Persistent floating trigger, bottom corner — the common chat-widget convention
// the user asked for. `insetInlineEnd` (§10) flips it to the bottom-left in RTL
// automatically. A circle is the one deliberate exception to §9.5's radius cap —
// same reasoning as the gold accent (§9.1): one bold, recognisable element, tokens
// throughout, no gradient/bubble styling.
export function AssistantLauncher() {
  const { t } = useTranslation();
  const isOpen = useAssistantUi((s) => s.isOpen);
  const open = useAssistantUi((s) => s.open);

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('assistant.title')}
      title={t('assistant.title')}
      style={{
        position: 'fixed',
        insetBlockEnd: 'var(--space-6)',
        insetInlineEnd: 'var(--space-6)',
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        border: 'none',
        background: 'var(--primary)',
        color: 'var(--on-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-floating)',
        zIndex: 40,
      }}
    >
      <MessageCircle size={22} strokeWidth={1.5} />
    </button>
  );
}
