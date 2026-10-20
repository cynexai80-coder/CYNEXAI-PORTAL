import { describe, it, expect, beforeEach } from 'vitest';
import { applyAutoLabels } from './autoLabel';

const mount = (html: string) => {
  document.body.innerHTML = html;
  applyAutoLabels(document);
};

describe('applyAutoLabels', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('links a label to the control that directly follows it', () => {
    mount('<div><label>Email</label><input type="email" /></div>');
    const input = document.querySelector('input')!;
    expect(input.labels?.[0]?.textContent).toBe('Email');
  });

  it('links a label to a single control wrapped in the next element', () => {
    mount('<div><label>Phone</label><div class="relative"><svg></svg><input type="tel" /></div></div>');
    expect(document.querySelector('input')!.labels?.length).toBe(1);
  });

  it('links a label to the only control in its parent when other markup sits between them', () => {
    mount('<div><label>Notes</label><p>hint</p><textarea></textarea></div>');
    expect(document.querySelector('textarea')!.labels?.[0]?.textContent).toBe('Notes');
  });

  it('does not guess when a parent holds several labels and controls', () => {
    mount('<div><label>A</label><p>x</p><input id="a" /><label>B</label><p>y</p><input id="b" /></div>');
    expect((document.getElementById('a') as HTMLInputElement).labels?.length).toBe(0);
  });

  it('keeps an existing htmlFor / aria-label untouched', () => {
    mount('<div><label for="x">Name</label><input id="y" /><input id="x" /></div><div><label>Other</label><input id="z" aria-label="Custom" /></div>');
    expect((document.getElementById('x') as HTMLInputElement).labels?.[0]?.textContent).toBe('Name');
    const z = document.getElementById('z') as HTMLInputElement;
    expect(z.getAttribute('aria-label')).toBe('Custom');
    expect(z.labels?.length).toBe(0);
  });

  it('names a select from the short text just before it', () => {
    mount('<div><span>Batch:</span><select><option>All</option></select></div>');
    expect(document.querySelector('select')!.getAttribute('aria-label')).toBe('Batch');
  });

  it('names a control from the text before its wrapper', () => {
    mount('<div><span>Sort:</span><div><select><option>A</option></select></div></div>');
    expect(document.querySelector('select')!.getAttribute('aria-label')).toBe('Sort');
  });

  it('does not use long text or interactive neighbours as a name', () => {
    mount('<div><p>This is a long paragraph that explains something rather lengthy about the field below.</p><input id="long" /></div><div><button>Go</button><input id="btn" /></div>');
    expect(document.getElementById('long')!.hasAttribute('aria-label')).toBe(false);
    expect(document.getElementById('btn')!.hasAttribute('aria-label')).toBe(false);
  });

  it('falls back to the placeholder for a field with nothing else to name it', () => {
    mount('<div><input id="ph" placeholder="Search students..." /></div>');
    expect(document.getElementById('ph')!.getAttribute('aria-label')).toBe('Search students');
  });

  it('ignores hidden and button-like inputs', () => {
    mount('<div><span>Token</span><input type="hidden" id="h" /></div><div><span>Save</span><input type="submit" id="s" value="Save" /></div>');
    expect(document.getElementById('h')!.hasAttribute('aria-label')).toBe(false);
    expect(document.getElementById('s')!.hasAttribute('aria-label')).toBe(false);
  });
});
