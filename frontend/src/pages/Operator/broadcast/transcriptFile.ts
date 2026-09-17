export function appendTranscriptLine(
  lines: string[],
  next: string
): string[] {
  const text = next.replace(/\r?\n/g, ' ').trimEnd();
  if (!text.trim()) {
    return lines;
  }
  if (lines.length === 0) {
    return [text.trimStart()];
  }

  const lastIndex = lines.length - 1;
  const previous = lines[lastIndex];
  const needsSentenceSpace = /[.!?。！？]$/.test(previous) && !/^\s/.test(text);
  const separator = needsSentenceSpace ? ' ' : '';

  return [
    ...lines.slice(0, lastIndex),
    `${previous}${separator}${text}`,
  ];
}

export function buildTranscriptDownload(
  inputLines: string[],
  outputLines: string[]
): string {
  const input = inputLines.join('\n');
  const output = outputLines.join('\n');
  return `Input (Korean)\n\n${input}\n\nOutput (German)\n\n${output}\n`;
}

export function buildTranscriptPaneDownload(lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
