import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { useAssistantUi } from './assistant.store';

// Persistent floating trigger in the reading-end corner, just above the status
// strip (`insetInlineEnd` flips it to the left in Arabic, §10). A yellow clay
// sign tile, not a round chat bubble (§9.2 — no capsule shapes).
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
      className="float-enter"
      style={{
        position: 'fixed',
        insetBlockEnd: 'calc(var(--status-strip-height) + 2 * var(--shell-gap) + var(--space-2))',
        insetInlineEnd: 'calc(var(--shell-gap) + var(--space-4))',
        width: '52px',
        height: '52px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        background: 'var(--sign)',
        color: 'var(--sign-legend)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: 'var(--clay-tinted), 0 12px 24px -10px var(--clay-drop)',
        zIndex: 40,
      }}
    >
      <MessageCircle size={22} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
