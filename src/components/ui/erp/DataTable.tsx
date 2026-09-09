import React, { useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export interface Column {
  key: string;
  header: string;
  editable?: boolean;
  filterable?: boolean;
  render?: (row: any) => React.ReactNode;
}

export interface DataTableProps {
  columns: Column[];
  data: any[];
  onSort?: (key: string) => void;
  onFilter?: (key: string, value: string) => void;
  onEdit?: (row: any, key: string, value: string) => void;
  renderExpandedRow?: (row: any) => React.ReactNode;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  onSort,
  onEdit,
  renderExpandedRow,
  sortBy,
  sortDir,
}) => {
  const [editingCell, setEditingCell] = useState<{ rowId: any; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<any>>(new Set());

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleEditBlur = (row: any, key: string) => {
    if (onEdit) {
      onEdit(row, key, editValue);
    }
    setEditingCell(null);
  };

  const handleCellClick = (row: any, col: Column) => {
    if (col.editable) {
      setEditingCell({ rowId: row.id, colKey: col.key });
      setEditValue(row[col.key]);
    }
  };

  const toggleRowExpansion = (rowId: any) => {
    if (!renderExpandedRow) return;
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  return (
    <div className="w-full overflow-x-auto bg-erp-surface border border-erp-border rounded-xl">
      <table className="w-full text-left text-sm text-erp-text border-collapse">
        <thead className="bg-erp-background border-b border-erp-border">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="p-4 font-bold text-erp-text/70 uppercase tracking-wider text-xs">
                <div 
                  className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => onSort && onSort(col.key)}
                >
                  {col.header}
                  {sortBy === col.key && (
                    sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const rowId = row.id || rowIndex;
            const isExpanded = expandedRows.has(rowId);
            return (
            <React.Fragment key={rowId}>
              <tr 
                className={`border-b border-erp-border hover:bg-erp-background/50 transition-colors ${renderExpandedRow ? 'cursor-pointer' : ''}`}
                onClick={() => toggleRowExpansion(rowId)}
              >
                {columns.map((col) => {
                  const isEditing =
                    editingCell?.rowId === row.id && editingCell?.colKey === col.key;

                  return (
                    <td 
                      key={col.key} 
                      className={`p-4 ${col.editable ? 'cursor-pointer hover:bg-erp-background' : ''}`}
                      onClick={(e) => {
                        if (col.editable) {
                          e.stopPropagation();
                          if (!isEditing) handleCellClick(row, col);
                        }
                      }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full bg-erp-surface border border-indigo-500 rounded px-2 py-1 text-sm text-erp-text focus:outline-none"
                          value={editValue}
                          onChange={handleEditChange}
                          onBlur={() => handleEditBlur(row, col.key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        col.render ? col.render(row) : row[col.key]
                      )}
                    </td>
                  );
                })}
              </tr>
              {isExpanded && renderExpandedRow && (
                <tr className="border-b border-erp-border bg-erp-background/30">
                  <td colSpan={columns.length} className="p-0">
                    <div className="overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {renderExpandedRow(row)}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          )})}
        </tbody>
      </table>
    </div>
  );
};
