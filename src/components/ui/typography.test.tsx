import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Heading, Paragraph, bindText } from './typography';

describe('shared text enhancements', () => {
  it('uses React-owned break opportunities and survives dynamic replacement', () => {
    const { rerender } = render(<Heading>今天开始整理我的学习计划</Heading>);
    expect(screen.getByRole('heading').querySelector('wbr')).not.toBeNull();
    expect(screen.getByRole('heading').textContent).toBe('今天开始整理我的学习计划');
    rerender(<Heading>明天复习数学与英语</Heading>);
    expect(screen.getByRole('heading').textContent).toBe('明天复习数学与英语');
  });
  it('never applies keep-all without break opportunities', () => {
    render(<Heading>AI</Heading>);
    expect(screen.getByRole('heading').hasAttribute('data-phrase-heading')).toBe(false);
  });
  it('leaves English and body text unsegmented', () => {
    const { container } = render(<><Heading lang="en">A long English heading</Heading><Paragraph>今天开始整理我的学习计划</Paragraph></>);
    expect(container.querySelector('wbr')).toBeNull();
    expect(screen.getByRole('heading').hasAttribute('data-phrase-heading')).toBe(false);
  });
  it('supports Traditional Chinese and preserves nested markup and escaping', () => {
    const { container } = render(<Heading lang="zh-Hant"><strong>今天開始整理我的學習計畫</strong>{'<script>'}</Heading>);
    expect(container.querySelector('strong wbr')).not.toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
  it('binds existing number/unit and attribution spaces, including JSX numbers', () => {
    expect(bindText('12 kg — Alice 3 km')).toBe('12\u00a0kg —\u00a0Alice 3\u00a0km');
    const { container } = render(<Paragraph>{12} kg <code>12 kg</code></Paragraph>);
    expect(container.querySelector('p')?.firstChild?.textContent).toBe('12\u00a0kg ');
    expect(container.querySelector('code')?.textContent).toBe('12 kg');
  });
  it('keeps a segmented heading accessible under its original name', () => {
    render(<Heading>这一周的安排</Heading>);
    expect(screen.getByRole('heading')).toHaveAccessibleName('这一周的安排');
  });
  it('preserves void elements inside text without adding children', () => {
    const { container } = render(<Paragraph>配图<img src="/sample.png" alt="示意图" /><br />说明</Paragraph>);
    expect(screen.getByRole('img', { name: '示意图' })).toHaveAttribute('src', '/sample.png');
    expect(container.querySelector('br')).not.toBeNull();
  });

});
