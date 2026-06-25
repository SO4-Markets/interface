import { afterEach, describe, expect, it } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { GmPoolsTable } from './gm-pools-table';
import type { Pool } from './gm-pools-table';

// Ensure cleanup after each test
afterEach(() => {
  cleanup();
});

describe('GmPoolsTable', () => {
  it('renders loading state', () => {
    render(<GmPoolsTable isLoading />);
    expect(screen.getByText('Loading pools...')).toBeTruthy();
  });

  it('renders empty state', () => {
    render(<GmPoolsTable pools={[]} />);
    expect(screen.getByText('No pools found.')).toBeTruthy();
  });

  it('renders fixture row and visible columns', () => {
    const fixture: Array<Pool> = [
      { id: '1', name: 'USDC/XLM', tvl: '$1,000,000', apr: '12%' },
    ];
    render(<GmPoolsTable pools={fixture} />);
    
    // Assert visible columns
    expect(screen.getByRole('columnheader', { name: 'Pool' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'TVL' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'APR' })).toBeTruthy();
    
    // Assert row text
    expect(screen.getByRole('cell', { name: 'USDC/XLM' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '$1,000,000' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '12%' })).toBeTruthy();
  });
});
