import * as React from 'react';
import { loadDefaultSimplifiedChineseParser, loadDefaultTraditionalChineseParser } from 'budoux';
import { useLang } from '@/contexts/LanguageContext';

const simplified = loadDefaultSimplifiedChineseParser();
const traditional = loadDefaultTraditionalChineseParser();

/** Only bind existing spaces; never rewrite stored copy or guess units. */
export function bindText(text: string) {
  return text.replace(/(—)[ \t]+(?=\S)/g, '$1\u00a0')
    .replace(/(\d)[ \t]+(?=(?:kg|km|cm|mm|ms|kcal|MB|GB|Hz|°C|CNY|JPY|USD|EUR|%|元|天|小时|分钟|公斤|千克|公里|米|克)(?![a-zA-Z]))/g, '$1\u00a0');
}

function textNodes(children: React.ReactNode, lang: string, heading: boolean): React.ReactNode {
  const merged: React.ReactNode[] = [];
  React.Children.forEach(children, child => {
    if ((typeof child === 'string' || typeof child === 'number') && typeof merged[merged.length - 1] === 'string') merged[merged.length - 1] += String(child);
    else merged.push(typeof child === 'number' ? String(child) : child);
  });
  return React.Children.map(merged, child => {
    if (typeof child === 'string') {
      const text = bindText(child);
      if (!heading || !/^zh\b/i.test(lang) || !/\p{Script=Han}/u.test(text)) return text;
      const parser = /hant|TW|HK|MO/i.test(lang) ? traditional : simplified;
      return <span data-phrase-run="">{parser.parse(text).map((part, i) => <React.Fragment key={i}>{i > 0 && <wbr aria-hidden="true" />}{part}</React.Fragment>)}</span>;
    }
    if (!React.isValidElement<{ children?: React.ReactNode; lang?: string; className?: string }>(child) || (typeof child.type !== 'string' && child.type !== React.Fragment)) return child;
    if (child.props.children == null || ['code', 'pre', 'input', 'textarea', 'svg'].includes(child.type as string) || child.props.className?.includes('font-mono')) return child;
    return React.cloneElement(child, {}, textNodes(child.props.children, child.props.lang || lang, heading));
  });
}

function hasBreakOpportunity(nodes: React.ReactNode): boolean {
  return React.Children.toArray(nodes).some(node => React.isValidElement<{ children?: React.ReactNode }>(node) && (node.type === 'wbr' || hasBreakOpportunity(node.props.children)));
}

/** Preserve the spoken title: optional visual breaks must not add word spaces. */
function headingLabel(children: React.ReactNode): string | undefined {
  let text = '';
  let known = true;
  React.Children.forEach(children, child => {
    if (typeof child === 'string' || typeof child === 'number') text += bindText(String(child));
    else if (child == null || typeof child === 'boolean') return;
    else if (React.isValidElement<{children?: React.ReactNode; 'aria-hidden'?: boolean | 'true' | 'false'; 'aria-label'?: string}>(child) && (typeof child.type === 'string' || child.type === React.Fragment)) {
      if (child.props['aria-hidden'] === true || child.props['aria-hidden'] === 'true') return;
      const nested = child.props['aria-label'] ?? headingLabel(child.props.children);
      if (nested === undefined) known = false; else text += nested;
    } else known = false;
  });
  return known ? text : undefined;
}

export const Heading = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3' }>(
  ({ as: Tag = 'h2', children, lang, ...props }, ref) => {
    const { lang: appLang } = useLang();
    const resolved = lang || appLang;
    const content = textNodes(children, resolved, true);
    const segmented = hasBreakOpportunity(content);
    return <Tag {...props} aria-label={props['aria-label'] ?? (segmented ? headingLabel(children) : undefined)} lang={resolved} ref={ref} data-phrase-heading={segmented ? '' : undefined}>{content}</Tag>;
  },
);
Heading.displayName = 'Heading';

export const Paragraph = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ children, lang, ...props }, ref) => {
    const { lang: appLang } = useLang();
    return <p {...props} lang={lang} ref={ref}>{textNodes(children, lang || appLang, false)}</p>;
  },
);
Paragraph.displayName = 'Paragraph';

export const markdownTypography = {
  h1: ({ children }: { children?: React.ReactNode }) => <Heading as="h1">{children}</Heading>,
  h2: ({ children }: { children?: React.ReactNode }) => <Heading as="h2">{children}</Heading>,
  h3: ({ children }: { children?: React.ReactNode }) => <Heading as="h3">{children}</Heading>,
  p: ({ children }: { children?: React.ReactNode }) => <Paragraph>{children}</Paragraph>,
};
