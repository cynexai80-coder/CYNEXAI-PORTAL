import { describe, it, expect } from 'vitest';
import { portalTitleFor } from './portalTitles';

describe('portalTitleFor', () => {
  it('names exact portal pages', () => {
    expect(portalTitleFor('/manager')).toBe('Manager Hub');
    expect(portalTitleFor('/student/quizzes')).toBe('Quizzes & Code Studio');
    expect(portalTitleFor('/login')).toBe('Sign in');
  });

  it('is case- and trailing-slash-insensitive', () => {
    expect(portalTitleFor('/Manager/')).toBe('Manager Hub');
    expect(portalTitleFor('/CEO/Reports')).toBe('Performance Reports');
  });

  it('shares titles across roles for common pages', () => {
    for (const role of ['sales', 'manager', 'dm', 'ceo', 'teacher']) {
      expect(portalTitleFor(`/${role}/tasks`)).toBe('My Tasks');
      expect(portalTitleFor(`/${role}/courses`)).toBe('Course Management');
    }
  });

  it('names parameterised routes', () => {
    expect(portalTitleFor('/manager/courses/c1/modules/m1')).toBe('Module Editor');
    expect(portalTitleFor('/manager/courses/c1/modules/m1/classes/k1')).toBe('Class Editor');
    expect(portalTitleFor('/sales/leads/lead_9')).toBe('Lead Profile');
    expect(portalTitleFor('/student/assessment/c1')).toBe('Assessment');
    expect(portalTitleFor('/apply/python-programming')).toBe('Apply for a Course');
  });

  it('does not invent titles for unknown or public marketing routes', () => {
    expect(portalTitleFor('/nope')).toBeNull();
    expect(portalTitleFor('/')).toBeNull();
    expect(portalTitleFor('/blog/some-post')).toBeNull();
  });
});
