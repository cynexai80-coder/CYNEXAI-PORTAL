import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import PlacementDashboard from '../PlacementDashboard';
import {
  PLACEMENT_STATS,
  COLLABORATED_COLLEGES,
  STREAM_OPPORTUNITIES,
  PLACED_STUDENTS,
} from '../../data/placementData';

describe('Placement Dashboard Suite', () => {
  const html = renderToString(
    <StaticRouter location="/placementdashboard">
      <PlacementDashboard initialAuth={true} />
    </StaticRouter>
  );

  it('verifies all 6 core metrics are strictly present in the placement dashboard', () => {
    // 1. No of colleges collaborated with CynexAI
    expect(html).toContain('Colleges Collaborated');
    expect(html).toContain(PLACEMENT_STATS.totalCollegesCollaborated.toString());
    expect(PLACEMENT_STATS.totalCollegesCollaborated).toBeGreaterThanOrEqual(50);

    // 2. No of students placed by CynexAI
    expect(html).toContain('Students Placed by CynexAI');
    expect(html).toContain(PLACEMENT_STATS.totalStudentsPlaced.toLocaleString());
    expect(PLACEMENT_STATS.totalStudentsPlaced).toBeGreaterThanOrEqual(1000);

    // 3. No of opportunities currently available
    expect(html).toContain('Opportunities Currently Available');
    expect(html).toContain(PLACEMENT_STATS.totalOpportunities.toString());
    expect(PLACEMENT_STATS.totalOpportunities).toBeGreaterThanOrEqual(200);

    // 4. CEC learned students available opportunities
    expect(html).toContain('CEC Available Opportunities');
    expect(html).toContain(PLACEMENT_STATS.cecOpportunities.toString());
    expect(PLACEMENT_STATS.cecOpportunities).toBeGreaterThanOrEqual(90);

    // 5. ECE learned students available opportunities
    expect(html).toContain('ECE Available Opportunities');
    expect(html).toContain(PLACEMENT_STATS.eceOpportunities.toString());
    expect(PLACEMENT_STATS.eceOpportunities).toBeGreaterThanOrEqual(70);

    // 6. Other NON IT students available opportunities
    expect(html).toContain('Other Non-IT Opportunities');
    expect(html).toContain(PLACEMENT_STATS.nonItOpportunities.toString());
    expect(PLACEMENT_STATS.nonItOpportunities).toBeGreaterThanOrEqual(70);
  });

  it('renders the placed students table headers and student records', () => {
    // Table title
    expect(html).toContain('Who Got Placed, Where, When &amp; CTC Package');

    // Table Column Headers
    expect(html).toContain('Student');
    expect(html).toContain('Stream / Branch');
    expect(html).toContain('Collaborated College');
    expect(html).toContain('Placed Company');
    expect(html).toContain('Role / Designation');
    expect(html).toContain('Package (CTC)');
    expect(html).toContain('Placed Date');
    expect(html).toContain('Status');

    // Placed student records rendered on Page 1 (Date Descending)
    expect(html).toContain('B. Lavanya');
    expect(html).toContain('Zuper Pvt Ltd');
    expect(html).toContain('₹5.4 LPA');

    expect(html).toContain('Ch. Karthik');
    expect(html).toContain('Cognizant');
    expect(html).toContain('₹6.0 LPA');

    expect(html).toContain('M. Sandhya Rani');
    expect(html).toContain('Infosys AI Labs');
    expect(html).toContain('₹8.0 LPA');

    expect(html).toContain('P. Akhil');
    expect(html).toContain('BeamX Techlab');
    expect(html).toContain('₹7.5 LPA');

    // And verify student roster includes K. Pullaiah and Sai Nath in data
    expect(PLACED_STUDENTS.some((s) => s.studentName === 'K. Pullaiah')).toBe(true);
    expect(PLACED_STUDENTS.some((s) => s.studentName === 'Sai Nath')).toBe(true);
    expect(PLACED_STUDENTS.some((s) => s.studentName === 'Anil Kumar')).toBe(true);
    expect(PLACED_STUDENTS.some((s) => s.studentName === 'Suresh Kumar')).toBe(true);
  });

  it('validates opportunity stream counts and data integrity', () => {
    const cecOpps = STREAM_OPPORTUNITIES.filter((o) => o.stream === 'CEC');
    const eceOpps = STREAM_OPPORTUNITIES.filter((o) => o.stream === 'ECE');
    const nonItOpps = STREAM_OPPORTUNITIES.filter((o) => o.stream === 'Non-IT');

    expect(cecOpps.length).toBeGreaterThan(0);
    expect(eceOpps.length).toBeGreaterThan(0);
    expect(nonItOpps.length).toBeGreaterThan(0);

    // Check college collaboration partner integrity
    expect(COLLABORATED_COLLEGES.length).toBeGreaterThanOrEqual(18);
    expect(COLLABORATED_COLLEGES.some((c) => c.shortName === 'JNTUK')).toBe(true);
    expect(COLLABORATED_COLLEGES.some((c) => c.shortName === 'JNTUH')).toBe(true);
    expect(COLLABORATED_COLLEGES.some((c) => c.shortName === 'Aditya Engg')).toBe(true);
  });

  it('validates placed students coverage across CEC, ECE, and Non-IT streams', () => {
    const placedCEC = PLACED_STUDENTS.filter((s) => s.stream === 'CEC');
    const placedECE = PLACED_STUDENTS.filter((s) => s.stream === 'ECE');
    const placedNonIT = PLACED_STUDENTS.filter((s) => s.stream === 'Non-IT');

    expect(placedCEC.length).toBeGreaterThan(5);
    expect(placedECE.length).toBeGreaterThan(5);
    expect(placedNonIT.length).toBeGreaterThan(5);

    // Every student has verified credentials
    PLACED_STUDENTS.forEach((student) => {
      expect(student.verifiedOfferId).toBeTruthy();
      expect(student.packageLpa).toBeGreaterThan(0);
      expect(student.company).toBeTruthy();
      expect(student.college).toBeTruthy();
    });
  });

  it('renders login gate cleanly when unauthenticated without revealing credentials', () => {
    const unauthHtml = renderToString(
      <StaticRouter location="/placementdashboard">
        <PlacementDashboard initialAuth={false} />
      </StaticRouter>
    );

    expect(unauthHtml).toContain('Placement Command Portal');
    expect(unauthHtml).toContain('Protected Dashboard');
    expect(unauthHtml).toContain('Admin Username');
    expect(unauthHtml).toContain('Password');
    // Ensure demo box and credential hints are completely removed
    expect(unauthHtml).not.toContain('Demo Login:');
    expect(unauthHtml).not.toContain('Auto-fill');
    expect(unauthHtml).not.toContain('placeholder=');
    expect(unauthHtml).toContain('Unlock Placement Dashboard');
  });

  it('renders admin badge and sign out button when authenticated', () => {
    const authHtml = renderToString(
      <StaticRouter location="/placementdashboard">
        <PlacementDashboard initialAuth={true} />
      </StaticRouter>
    );

    expect(authHtml).toContain('Admin: cynexai800');
    expect(authHtml).toContain('Sign Out');
    expect(authHtml).toContain('Institutional Placement &amp; Opportunities Command');
  });
});

