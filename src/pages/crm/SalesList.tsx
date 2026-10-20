import React, { useEffect, useState, useMemo } from 'react';
import { getSales, Sale } from '../../lib/api/sales';
import { Card } from '../../components/ui/erp/Card';
import { getCurrentUser } from '../../lib/auth';
import { User, Calendar, CreditCard, Tag, BadgeIndianRupee, Search, Filter } from 'lucide-react';

export default function SalesList() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const user = getCurrentUser();
  const isManager = user?.role === 'Manager' || user?.role === 'CEO';

  useEffect(() => {
    getSales().then(setSales);
  }, []);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const matchesSearch = 
        (sale.lead_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sale.executive_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sale.course_name || sale.course_id || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || sale.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [sales, searchQuery, statusFilter]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-erp-background">
      <div className="flex-1 flex flex-col p-4 md:p-8 min-w-0">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-erp-text">Sales History</h1>
            <p className="text-sm font-bold text-erp-text/50 mt-1">Detailed track record of all closed and partial sales</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-erp-text/40" />
              <input
                type="text"
                placeholder="Search sales..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-full md:w-64 bg-white dark:bg-black border-2 border-erp-border rounded-xl text-sm font-medium focus:outline-none focus:border-erp-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-black border-2 border-erp-border rounded-xl text-sm font-medium focus:outline-none focus:border-erp-primary appearance-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Sale Completed">Sale Completed</option>
              <option value="Sale Partial Closed">Partial Closed</option>
            </select>
          </div>
        </div>
        
        <div className="hidden md:block bg-erp-surface border-2 border-erp-border rounded-3xl overflow-hidden flex-1 overflow-y-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-erp-background/80 backdrop-blur-md sticky top-0 z-10 border-b-2 border-erp-border">
              <tr>
                <th className="p-4 font-bold text-erp-text/70 uppercase text-[10px] tracking-wider"><div className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Date</div></th>
                <th className="p-4 font-bold text-erp-text/70 uppercase text-[10px] tracking-wider"><div className="flex items-center gap-1"><User className="w-3 h-3"/> Student Name</div></th>
                <th className="p-4 font-bold text-erp-text/70 uppercase text-[10px] tracking-wider"><div className="flex items-center gap-1"><Tag className="w-3 h-3"/> Course</div></th>
                <th className="p-4 font-bold text-erp-text/70 uppercase text-[10px] tracking-wider"><div className="flex items-center gap-1"><CreditCard className="w-3 h-3"/> Total Fee</div></th>
                <th className="p-4 font-bold text-erp-text/70 uppercase text-[10px] tracking-wider"><div className="flex items-center gap-1"><BadgeIndianRupee className="w-3 h-3"/> Amount Paid</div></th>
                <th className="p-4 font-bold text-erp-text/70 uppercase text-[10px] tracking-wider">Status</th>
                {isManager && (
                  <th className="p-4 font-bold text-erp-primary uppercase text-[10px] tracking-wider bg-erp-primary/5">
                    <div className="flex items-center gap-1"><User className="w-3 h-3"/> Executive ({user?.role} View)</div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-erp-border/50">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 7 : 6} className="p-10 text-center font-bold text-erp-text/50">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CreditCard className="w-8 h-8 opacity-20" />
                      <span>No sales recorded yet.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-erp-primary/5 transition-colors group">
                    <td className="p-4 text-xs font-bold text-erp-text/70 whitespace-nowrap">{formatDate(sale.created_at)}</td>
                    <td className="p-4 font-bold text-erp-text">
                      {sale.lead_name || 'Unknown Student'}
                      <div className="text-[10px] text-erp-text/40 font-mono mt-0.5">{sale.id}</div>
                    </td>
                    <td className="p-4 text-sm font-bold text-erp-text/80">{sale.course_name || sale.course_id}</td>
                    <td className="p-4 font-bold text-erp-text/90">₹{(sale.total_fee || 0).toLocaleString()}</td>
                    <td className="p-4 font-bold text-erp-primary">₹{(sale.amount_paid || 0).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wide font-bold inline-flex items-center gap-1.5 ${
                        sale.status?.toLowerCase().includes('completed') || sale.status === 'Sale Completed' 
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-white border border-green-200' 
                          : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sale.status?.toLowerCase().includes('completed') ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        {sale.status}
                      </span>
                    </td>
                    {isManager && (
                      <td className="p-4 bg-erp-primary/5 group-hover:bg-erp-primary/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-erp-primary/20 text-erp-primary flex items-center justify-center text-xs font-bold uppercase">
                            {(sale.executive_name || 'U').slice(0,2)}
                          </div>
                          <span className="font-bold text-sm text-erp-text">{sale.executive_name || 'Unknown'}</span>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col gap-4 overflow-y-auto flex-1 pb-32">
          {filteredSales.length === 0 ? (
            <div className="text-center p-10 text-erp-text/50 font-bold border-2 border-dashed border-erp-border rounded-3xl">
              No sales recorded yet.
            </div>
          ) : (
            filteredSales.map((sale) => (
              <Card key={sale.id} className="relative overflow-hidden">
                {isManager && (
                  <div className="absolute top-0 right-0 bg-erp-primary text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                    By: {sale.executive_name || 'Unknown'}
                  </div>
                )}
                <div className="flex justify-between items-start mb-3 pt-2">
                  <div>
                    <h3 className="font-bold text-lg text-erp-text">{sale.lead_name || 'Unknown Student'}</h3>
                    <p className="text-erp-text/50 font-bold text-xs">{sale.course_name || sale.course_id}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                    sale.status?.toLowerCase().includes('completed') ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-white' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {sale.status}
                  </span>
                </div>
                
                <div className="text-xs text-erp-text/50 font-bold mb-4 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {formatDate(sale.created_at)}
                </div>

                <div className="flex justify-between bg-erp-background rounded-xl p-3 border border-erp-border">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-erp-text/70 font-bold mb-1">Total Fee</span>
                    <span className="font-bold text-erp-text">₹{(sale.total_fee || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-erp-text/70 font-bold mb-1">Paid</span>
                    <span className="font-bold text-erp-primary">₹{(sale.amount_paid || 0).toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
