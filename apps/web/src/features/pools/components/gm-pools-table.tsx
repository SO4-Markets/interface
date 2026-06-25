
import type { PoolMarketConfig } from '../data/markets';

export interface Pool {
  id: string;
  name: string;
  tvl: string;
  apr: string;
}

export interface GmPoolsTableProps {
  isLoading?: boolean;
  pools?: Array<Pool>;
  markets?: Array<PoolMarketConfig>;
}

export function GmPoolsTable({ isLoading, pools, markets }: GmPoolsTableProps) {
  const data = pools || (markets ? markets.map(m => ({
    id: m.marketToken,
    name: m.displayName,
    tvl: '...',
    apr: '...'
  })) : []);
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading pools...</div>;
  }

  if (data.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No pools found.</div>;
  }

  return (
    <div className="w-full overflow-auto border rounded-md">
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-muted text-muted-foreground">
          <tr>
            <th className="px-6 py-3 font-medium">Pool</th>
            <th className="px-6 py-3 font-medium">TVL</th>
            <th className="px-6 py-3 font-medium">APR</th>
          </tr>
        </thead>
        <tbody>
          {data.map((pool) => (
            <tr key={pool.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
              <td className="px-6 py-4">{pool.name}</td>
              <td className="px-6 py-4">{pool.tvl}</td>
              <td className="px-6 py-4">{pool.apr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
