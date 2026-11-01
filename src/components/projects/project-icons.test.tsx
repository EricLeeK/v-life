import { describe, expect, it } from 'vitest';
import { defaultProjectIcon, iconSvg, projectIconPresets } from './project-icons';
describe('project SVG icons', () => {
  it('chooses different topic-specific defaults and a fallback', () => {
    expect(defaultProjectIcon('可微分FEM框架')).toBe(iconSvg('mesh'));
    expect(defaultProjectIcon('毕业论文')).toBe(iconSvg('thesis'));
    expect(defaultProjectIcon('个人技术博客')).toBe(iconSvg('globe'));
    expect(defaultProjectIcon('新项目')).toBe(iconSvg('compass'));
  });
  it('provides 30 distinct, valid standalone SVG presets', () => {
    expect(projectIconPresets).toHaveLength(30);
    expect(new Set(projectIconPresets.map(icon => icon.id)).size).toBe(30);
    expect(new Set(projectIconPresets.map(icon => iconSvg(icon.id))).size).toBe(30);
    for (const preset of projectIconPresets) {
      const doc = new DOMParser().parseFromString(iconSvg(preset.id), 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBeNull();
      expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 24 24');
    }
  });
});
