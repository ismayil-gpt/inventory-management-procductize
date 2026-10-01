// Reads the DESC control matrix (documentation/security-compliance/
// control-implementation-matrix.md) at build time, so the in-app page and the
// evidence file can never disagree: the page claims exactly what the file says.
import matrixMarkdown from '../../../../documentation/security-compliance/control-implementation-matrix.md?raw';

export type ControlStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED';

export interface ControlRow {
  number: number;
  /** English control wording as written in the matrix (also the Arabic fallback). */
  controlEn: string;
  status: ControlStatus;
  /** Where the control lives and its evidence — technical, English only. */
  evidence: string;
}

const STATUS_BY_SYMBOL: Record<string, ControlStatus> = {
  '☐': 'NOT_STARTED',
  '◐': 'IN_PROGRESS',
  '☑': 'IMPLEMENTED',
  '✔': 'VERIFIED',
};

export function parseControlMatrix(markdown: string = matrixMarkdown): { rows: ControlRow[]; lastUpdated: string | null } {
  const rows: ControlRow[] = [];
  for (const line of markdown.split('\n')) {
    // Table rows look like: | 3 | Password storage (…) | ✔ | evidence … |
    const match = /^\|\s*(\d+)\s*\|(.+?)\|\s*([☐◐☑✔])\s*\|(.*)\|\s*$/.exec(line);
    if (!match) continue;
    rows.push({
      number: Number(match[1]),
      controlEn: match[2].trim(),
      status: STATUS_BY_SYMBOL[match[3]],
      evidence: match[4].trim().replace(/`|\*\*/g, ''),
    });
  }
  const updated = /Last updated:\s*\*\*(\d{4}-\d{2}-\d{2})\*\*/.exec(markdown);
  return { rows, lastUpdated: updated ? updated[1] : null };
}
