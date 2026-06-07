/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  Link, 
  Filter, 
  Sliders, 
  ArrowRightLeft, 
  Combine, 
  SlidersHorizontal,
  ChevronRight,
  Database
} from 'lucide-react';
import { type Table, type Column, type JoinConfig, type FilterConfig, type SelectField, type OrderByConfig } from '../types';

interface VisualQueryBuilderProps {
  tables: Table[];
  fromTable: string;
  setFromTable: (table: string) => void;
  fields: SelectField[];
  setFields: React.Dispatch<React.SetStateAction<SelectField[]>>;
  joins: JoinConfig[];
  setJoins: React.Dispatch<React.SetStateAction<JoinConfig[]>>;
  filters: FilterConfig[];
  setFilters: React.Dispatch<React.SetStateAction<FilterConfig[]>>;
  groupBy: string[];
  setGroupBy: React.Dispatch<React.SetStateAction<string[]>>;
  orderBy: OrderByConfig[];
  setOrderBy: React.Dispatch<React.SetStateAction<OrderByConfig[]>>;
  limit: number;
  setLimit: (limit: number) => void;
}

const AGGREGATE_FUNCTIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const;

export default function VisualQueryBuilder({
  tables,
  fromTable,
  setFromTable,
  fields,
  setFields,
  joins,
  setJoins,
  filters,
  setFilters,
  groupBy,
  setGroupBy,
  orderBy,
  setOrderBy,
  limit,
  setLimit
}: VisualQueryBuilderProps) {

  // Retrieve columns of all tables involved in the query (fromTable + joins)
  const getQueryAvailableTables = (): string[] => {
    const list = new Set<string>();
    if (fromTable) list.add(fromTable);
    joins.forEach(j => {
      if (j.leftTable) list.add(j.leftTable);
      if (j.rightTable) list.add(j.rightTable);
    });
    return Array.from(list);
  };

  // List all available columns grouped under their respective tables
  const getAvailableColumns = (): { table: string; column: string; type: string }[] => {
    const activeTables = getQueryAvailableTables();
    const colsList: { table: string; column: string; type: string }[] = [];

    activeTables.forEach(tName => {
      const matchedTable = tables.find(t => t.name === tName);
      if (matchedTable) {
        matchedTable.columns.forEach(c => {
          colsList.push({ table: tName, column: c.name, type: c.type });
        });
      }
    });

    return colsList;
  };

  // Toggle standard select fields
  const handleToggleColumnSelect = (table: string, column: string) => {
    const matchIdx = fields.findIndex(f => f.table === table && f.column === column && !f.aggregate);
    if (matchIdx > -1) {
      setFields(fields.filter((_, idx) => idx !== matchIdx));
    } else {
      setFields([...fields, { id: `${table}_${column}_${Date.now()}`, table, column }]);
    }
  };

  // Add custom select fields with aggregate metrics
  const handleAddAggregateField = (table: string, col: string, aggType: typeof AGGREGATE_FUNCTIONS[number]) => {
    const newField: SelectField = {
      id: `${table}_${col}_${aggType}_${Date.now()}`,
      table,
      column: col,
      aggregate: aggType,
      alias: `${aggType.toLowerCase()}_${col}`
    };
    setFields([...fields, newField]);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleUpdateAlias = (id: string, newAlias: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, alias: newAlias } : f));
  };

  // Add Visual Joins manually
  const handleAddJoin = () => {
    const activeTables = getQueryAvailableTables();
    const availableTablesNames = tables.map(t => t.name);
    const unjoined = availableTablesNames.find(name => !activeTables.includes(name));
    
    const leftTable = fromTable;
    const rightTable = unjoined || availableTablesNames[0] || '';
    
    // Attempt default column matches on primary keys or matching names
    let leftColumn = 'id';
    let rightColumn = 'id';
    
    const leftTInstance = tables.find(t => t.name === leftTable);
    const rightTInstance = tables.find(t => t.name === rightTable);
    
    if (leftTInstance && rightTInstance) {
      // Find foreign match
      const matchingFk = rightTInstance.columns.find(c => c.foreignKey?.table === leftTable);
      if (matchingFk && matchingFk.foreignKey) {
        leftColumn = matchingFk.foreignKey.column;
        rightColumn = matchingFk.name;
      }
    }

    const newJoin: JoinConfig = {
      id: `join_${Date.now()}`,
      type: 'INNER JOIN',
      leftTable,
      leftColumn,
      rightTable,
      rightColumn
    };
    setJoins([...joins, newJoin]);
  };

  const handleRemoveJoin = (id: string) => {
    setJoins(joins.filter(j => j.id !== id));
  };

  const handleUpdateJoin = (id: string, updates: Partial<JoinConfig>) => {
    setJoins(joins.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  // Add dynamic WHERE filters
  const handleAddFilter = () => {
    const avCols = getAvailableColumns();
    if (avCols.length === 0) return;

    const newFilter: FilterConfig = {
      id: `filter_${Date.now()}`,
      table: avCols[0].table,
      column: avCols[0].column,
      operator: '=',
      value: '',
      logic: 'AND'
    };
    setFilters([...filters, newFilter]);
  };

  const handleRemoveFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const handleUpdateFilter = (id: string, updates: Partial<FilterConfig>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // Add sorting conditions directly
  const handleAddOrderBy = () => {
    const avCols = getAvailableColumns();
    if (avCols.length === 0) return;

    // Check if sorting condition already exist, skip if same
    if (orderBy.some(o => o.table === avCols[0].table && o.column === avCols[0].column)) return;

    const newOrder: OrderByConfig = {
      table: avCols[0].table,
      column: avCols[0].column,
      direction: 'ASC'
    };
    setOrderBy([...orderBy, newOrder]);
  };

  const handleRemoveOrderBy = (table: string, column: string) => {
    setOrderBy(orderBy.filter(o => !(o.table === table && o.column === column)));
  };

  const handleToggleGroupBy = (colKey: string) => {
    if (groupBy.includes(colKey)) {
      setGroupBy(groupBy.filter(g => g !== colKey));
    } else {
      setGroupBy([...groupBy, colKey]);
    }
  };

  // Check if columns is already selected
  const isColChecked = (tName: string, cName: string): boolean => {
    return fields.some(f => f.table === tName && f.column === cName && !f.aggregate);
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: TARGET BASE FROM TABLE */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">1. Choose Base Query Table</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <select
              value={fromTable}
              onChange={(e) => {
                setFromTable(e.target.value);
                // Reset select fields to include all from table by default
                const newTbl = tables.find(t => t.name === e.target.value);
                if (newTbl) {
                  setFields(newTbl.columns.map(c => ({
                    id: `${newTbl.name}_${c.name}_${Date.now()}`,
                    table: newTbl.name,
                    column: c.name
                  })));
                } else {
                  setFields([]);
                }
                setJoins([]);
                setFilters([]);
                setGroupBy([]);
                setOrderBy([]);
              }}
              className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
            >
              <option value="">-- Choose Base Table --</option>
              {tables.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <p className="md:col-span-2 text-xs text-slate-400 flex items-center leading-relaxed">
            This configures the FROM clause of the statement. Changing this will clear existing joins or filters to prevent column mismatching error constraints.
          </p>
        </div>
      </div>

      {fromTable && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-150">
          
          {/* SECTION 2: COLUMN SPECIFICATION AND FIELD SELECTOR */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Combine className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">2. Configure SELECT Columns</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-normal">
                Determine which features are returned. Check columns directly, or compile calculations like aggregates.
              </p>

              {/* LIST COLUMNS CHECKBOX GRID */}
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {getQueryAvailableTables().map(tName => {
                  const tableObj = tables.find(t => t.name === tName);
                  if (!tableObj) return null;
                  return (
                    <div key={tName} className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-850/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-400 block pb-1 border-b border-slate-900">
                        Table: {tName}
                      </span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {tableObj.columns.map(col => {
                          const checked = isColChecked(tName, col.name);
                          return (
                            <div key={col.name} className="flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="checkbox"
                                  id={`select-${tName}-${col.name}`}
                                  checked={checked}
                                  onChange={() => handleToggleColumnSelect(tName, col.name)}
                                  className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                                />
                                <label 
                                  htmlFor={`select-${tName}-${col.name}`} 
                                  className="font-mono text-slate-300 font-medium select-none cursor-pointer hover:text-white transition"
                                >
                                  {col.name}
                                </label>
                              </div>
                              
                              {/* QUICK AGGREGATE TRIGGER */}
                              <div className="flex gap-1.5 pl-6">
                                {AGGREGATE_FUNCTIONS.slice(0, 3).map(agg => (
                                  <button
                                    key={agg}
                                    type="button"
                                    onClick={() => handleAddAggregateField(tName, col.name, agg)}
                                    className="text-[9px] font-mono text-slate-550 hover:text-emerald-400 tracking-wider hover:bg-slate-900 px-1 py-0.5 rounded uppercase font-bold transition"
                                    title={`Inject aggregate SELECT: ${agg}(${col.name})`}
                                  >
                                    +{agg}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEPARATE FIELD ALIAS WORKSPACE */}
            {fields.length > 0 && (
              <div className="mt-5 border-t border-slate-850 pt-4 space-y-3">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block">Target SQL Select Fields & Aliases:</span>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {fields.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-900 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-semibold">
                          {f.aggregate ? `${f.aggregate}(${f.table}.${f.column})` : `${f.table}.${f.column}`}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[10px]">AS</span>
                        <input 
                          type="text"
                          placeholder="alias_name"
                          value={f.alias || ''}
                          onChange={(e) => handleUpdateAlias(f.id, e.target.value)}
                          className="bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 rounded px-2 py-0.5 focus:outline-none w-28 text-left"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveField(f.id)}
                          className="text-slate-650 hover:text-rose-500 transition ml-1"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: VISUAL JOIN AND REACTION CHUNKS */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">3. Create SQL JOINS</h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddJoin}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] rounded font-semibold flex items-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" />
                  Add JOIN
                </button>
              </div>

              <p className="text-xs text-slate-400 mt-0.5 leading-normal">
                Establish dynamic multi-table queries. Match primary key IDs on transactional metadata tables.
              </p>

              {joins.length === 0 ? (
                <div className="h-44 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-4">
                  <Link className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-slate-500 text-xs">No visual JOINS added. Query is restricted to single base table.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {joins.map((join, idx) => (
                    <div key={join.id} className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3- relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-yellow-500 font-mono">JOIN #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveJoin(join.id)}
                          className="text-slate-500 hover:text-rose-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-xs">
                        {/* JOIN TYPE */}
                        <div className="md:col-span-3">
                          <select
                            value={join.type}
                            onChange={(e) => handleUpdateJoin(join.id, { type: e.target.value as any })}
                            className="bg-slate-900 border border-slate-800 rounded p-1 px-1.5 text-slate-300 font-mono cursor-pointer"
                          >
                            <option value="INNER JOIN">INNER JOIN</option>
                            <option value="LEFT JOIN">LEFT JOIN</option>
                            <option value="RIGHT JOIN">RIGHT JOIN</option>
                          </select>
                        </div>

                        {/* RIGHT TABLE/COLUMN NAME */}
                        <div className="md:col-span-9 flex flex-wrap items-center gap-2">
                          <select
                            value={join.rightTable}
                            onChange={(e) => {
                              const tName = e.target.value;
                              const tableObj = tables.find(t => t.name === tName);
                              const defaultCol = tableObj?.columns[0]?.name || 'id';
                              handleUpdateJoin(join.id, { rightTable: tName, rightColumn: defaultCol });
                            }}
                            className="bg-slate-900 border border-slate-800 rounded p-1 text-slate-300 font-mono text-[11px] cursor-pointer"
                          >
                            {tables.map(t => (
                              <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                          </select>

                          <span className="text-slate-500">ON</span>

                          <select
                            value={`${join.leftTable}.${join.leftColumn}`}
                            onChange={(e) => {
                              const [t, c] = e.target.value.split('.');
                              handleUpdateJoin(join.id, { leftTable: t, leftColumn: c });
                            }}
                            className="bg-slate-900 border border-slate-800 rounded p-1 text-slate-300 font-mono text-[11px] cursor-pointer"
                          >
                            {getAvailableColumns().map(ac => (
                              <option key={`${ac.table}.${ac.column}`} value={`${ac.table}.${ac.column}`}>
                                {ac.table}.{ac.column}
                              </option>
                            ))}
                          </select>

                          <span className="text-slate-400">=</span>

                          <select
                            value={join.rightColumn}
                            onChange={(e) => handleUpdateJoin(join.id, { rightColumn: e.target.value })}
                            className="bg-slate-900 border border-slate-800 rounded p-1 text-slate-300 font-mono text-[11px] cursor-pointer"
                          >
                            {tables.find(t => t.name === join.rightTable)?.columns.map(c => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            )) || <option value="id">id</option>}
                          </select>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* SECTION 4: FILTER WHERE CONDITIONS, SORTING & GROUP BY */}
      {fromTable && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
          
          {/* COLUMN 1: WHERE FILTERS */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">4. Filter WHERE Conditions</h3>
              </div>
              <button
                type="button"
                onClick={handleAddFilter}
                className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-[10px] text-slate-200 border border-slate-800 rounded font-semibold"
              >
                + Criteria
              </button>
            </div>

            {filters.length === 0 ? (
              <p className="text-slate-500 text-xs py-10 text-center italic">No filters added. Fetching full dataset rows without gates.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {filters.map((flt, idx) => (
                  <div key={flt.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      {idx === 0 ? (
                        <span className="text-[10px] font-bold text-slate-550 font-mono">WHERE</span>
                      ) : (
                        <select
                          value={flt.logic}
                          onChange={(e) => handleUpdateFilter(flt.id, { logic: e.target.value as any })}
                          className="bg-slate-900 border border-slate-800 rounded p-[2px] font-mono text-[9px] text-yellow-500 cursor-pointer"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveFilter(flt.id)}
                        className="text-slate-600 hover:text-rose-500 transition text-xs"
                      >
                        ×
                      </button>
                    </div>

                    <div className="grid grid-cols-12 gap-1.5 items-center text-[11px] font-mono">
                      {/* TARGET COLUMN */}
                      <select
                        value={`${flt.table}.${flt.column}`}
                        onChange={(e) => {
                          const [t, c] = e.target.value.split('.');
                          handleUpdateFilter(flt.id, { table: t, column: c });
                        }}
                        className="col-span-5 bg-slate-900 border border-slate-800 rounded p-1 text-slate-350 cursor-pointer text-[10px]"
                      >
                        {getAvailableColumns().map(ac => (
                          <option key={`${ac.table}.${ac.column}`} value={`${ac.table}.${ac.column}`}>
                            {ac.table}.{ac.column}
                          </option>
                        ))}
                      </select>

                      {/* OPERATOR */}
                      <select
                        value={flt.operator}
                        onChange={(e) => handleUpdateFilter(flt.id, { operator: e.target.value as any })}
                        className="col-span-3 bg-slate-900 border border-slate-800 rounded p-1 text-emerald-400 font-bold text-center cursor-pointer text-[10px]"
                      >
                        <option value="=">=</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value="LIKE">LIKE</option>
                        <option value="IN">IN</option>
                        <option value="IS NULL">NULL</option>
                      </select>

                      {/* INPUT VALUE */}
                      {flt.operator !== 'IS NULL' ? (
                        <input 
                          type="text" 
                          placeholder="value"
                          value={flt.value}
                          onChange={(e) => handleUpdateFilter(flt.id, { value: e.target.value })}
                          className="col-span-4 bg-slate-900 border border-slate-800 rounded p-1 text-slate-300 placeholder:text-slate-650"
                        />
                      ) : (
                        <span className="col-span-4 text-center text-slate-550">[No Input]</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COLUMN 2: ORDER BY AND GROUP BY */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">5. Key Sorting (ORDER BY)</h3>
              </div>
              <button
                type="button"
                onClick={handleAddOrderBy}
                className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-[10px] text-slate-200 border border-slate-800 rounded font-semibold"
              >
                + Criteria
              </button>
            </div>

            {orderBy.length === 0 ? (
              <p className="text-slate-500 text-xs py-10 text-center italic">No ordering filters mapped. Relying on default table indices.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {orderBy.map((ord) => (
                  <div key={`${ord.table}.${ord.column}`} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-xs font-mono">
                    <span className="text-slate-330 font-semibold">{ord.table}.{ord.column}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={ord.direction}
                        onChange={(e) => {
                          const updated = orderBy.map(o => o.table === ord.table && o.column === ord.column ? { ...o, direction: e.target.value as any } : o);
                          setOrderBy(updated);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded p-[2px] font-bold text-[10px] text-emerald-400 cursor-pointer"
                      >
                        <option value="ASC">ASC</option>
                        <option value="DESC">DESC</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveOrderBy(ord.table, ord.column)}
                        className="text-slate-650 hover:text-rose-500 transition text-sm font-bold pl-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DYNAMIC GROUP BY AUTO-INJECTION */}
            {fields.some(f => f.aggregate) && (
              <div className="mt-4 pt-4 border-t border-slate-850 space-y-2">
                <span className="text-[10px] font-mono text-yellow-500 font-bold block uppercase">⚠️ Aggregates detected: Configure GROUP BY</span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  You are evaluating aggregate functions. Ensure you add standard SELECT column strings here to satisfy relational requirements.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {fields.filter(f => !f.aggregate).map(f => {
                    const colKey = `${f.table}.${f.column}`;
                    const groupChecked = groupBy.includes(colKey);
                    return (
                      <button
                        key={colKey}
                        type="button"
                        onClick={() => handleToggleGroupBy(colKey)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded transition ${
                          groupChecked 
                            ? 'bg-emerald-500 text-slate-950 font-bold' 
                            : 'bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-850'
                        }`}
                      >
                        {colKey} {groupChecked ? '[✓]' : '[+]'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* COLUMN 3: RESULTS ROWS LIMITS CONTROL */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">6. Results Limits (LIMIT)</h3>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Avoid memory spool bloating. Sliders controls final returned lines directly inside query statement details.
              </p>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-500">Row Count Limit</span>
                  <span className="text-emerald-400 font-bold">{limit}</span>
                </div>
                <input 
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg appearance-none"
                />
              </div>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-850 text-[10px] font-mono text-slate-500 leading-normal">
              LIMIT statement guarantees the rendering preview compiles fast, maintaining the database index loop pipeline.
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
