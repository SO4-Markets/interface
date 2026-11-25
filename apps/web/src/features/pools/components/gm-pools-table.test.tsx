import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { GmPoolsTable } from './gm-pools-table';
import type { Pool } from './gm-pools-table';

afterEach(() => {
  cleanup();
});

describe('GmPoolsTable', () => {
  it('renders loading state', () => {
    const { container } = render(<GmPoolsTable isLoading />);
    expect(container.querySelector('[data-slot="data-table-loading"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="loading-cards-state"]')).toBeTruthy();
  });

  it('renders empty state', () => {
    const { container } = render(<GmPoolsTable pools={[]} />);
    expect(container.querySelector('[data-slot="empty-state"]')).toBeTruthy();
    expect(screen.getByText('No pools found')).toBeTruthy();
  });

  it('renders fixture row and visible columns', () => {
    const fixture: Array<Pool> = [
      { id: '1', name: 'USDC/XLM', tvl: '$1,000,000', apr: '12%' },
    ];
    render(<GmPoolsTable pools={fixture} />);

    expect(screen.getByRole('columnheader', { name: 'Pool' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'TVL' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'APR' })).toBeTruthy();

    expect(screen.getByRole('cell', { name: 'USDC/XLM' })).toBeTruthy();
    expect(screen.getAllByText('$1.0M').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('+12.00%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile cards with accessible labels and values', () => {
    const fixture: Array<Pool> = [
      { id: 'pool-1', name: 'USDC/XLM', tvl: '$1,000,000', apr: '12%' },
      { id: 'pool-2', name: 'BTC/USD', tvl: '$5,000,000', apr: '8%' },
    ];
    render(<GmPoolsTable pools={fixture} />);

    const list = screen.getByRole('list', { name: 'Liquidity pools' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(within(items[0]!).getByText('USDC/XLM')).toBeInTheDocument();
    expect(within(items[0]!).getByText('TVL')).toBeInTheDocument();
    expect(within(items[0]!).getByText('APR')).toBeInTheDocument();
  });

  it('has no accessibility violations across responsive states', async () => {
    const fixture: Array<Pool> = [
      { id: '1', name: 'USDC/XLM', tvl: '$1,000,000', apr: '12%' },
    ];
    const { container: loadedContainer } = render(<GmPoolsTable pools={fixture} />);
    expect(await axe(loadedContainer)).toHaveNoViolations();

    const { container: emptyContainer } = render(<GmPoolsTable pools={[]} />);
    expect(await axe(emptyContainer)).toHaveNoViolations();
  });
});
