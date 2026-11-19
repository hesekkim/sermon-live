import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InterpreterSection from '../../src/pages/Operator/settings/components/InterpreterSection';
import { operatorCopy } from '../../src/pages/Operator/translations';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
});

describe('InterpreterSection', () => {
  it('uses the missing status instead of repeating the missing-key warning', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <InterpreterSection
          labels={operatorCopy.en}
          interpreter="openai"
          onInterpreterChange={vi.fn()}
          apiKey=""
          onApiKeyChange={vi.fn()}
          keyStatus="missing"
          keyWarning="OpenAI API key is not set"
          isValidatingKey={false}
          keyValidationFailed={false}
          savedKeyPreview=""
          disabled={false}
          translationTargetLanguage="de"
          onTranslationTargetLanguageChange={vi.fn()}
        />,
      );
    });

    expect(container).toHaveTextContent('Missing');
    expect(container).not.toHaveTextContent('OpenAI API key is not set');

    act(() => root.unmount());
    container.remove();
  });
});
