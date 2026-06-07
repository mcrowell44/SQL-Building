/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Play, 
  Download, 
  FileSpreadsheet, 
  Mail, 
  Database,
  ArrowRight,
  Clipboard,
  Check,
  Edit2,
  Trash2,
  Lock,
  Plus
} from 'lucide-react';
import { type Table, type Column, type VisualQueryState } from '../types';

interface QueryConsoleProps {
  tables: Table[];
  queryState: VisualQueryState;
  onSendEmailResults: (subject: string, htmlContent: string) => void;
  onSaveQueryToDrive: (fileName: string, sqlContent: string) => void;
  isWorkspaceConnected: boolean;
}

// Global Starter mock datasets kept in sync
const DEFAULT_MOCK_DATA: Record<string, Array<Record<string, any>>> = {
  customers: [
    { id: 1, name: 'Alice Johnson', email: 'alice@google.com', country: 'United States', created_at: '2026-01-10 10:20:00' },
    { id: 2, name: 'Marcus Crowell', email: 'marcuscrowell44@gmail.com', country: 'Canada', created_at: '2026-02-14 11:32:00' },
    { id: 3, name: 'Sarah Connor', email: 'sarah.connor@gmail.com', country: 'United Kingdom', created_at: '2026-03-01 09:00:00' },
    { id: 4, name: 'Kenji Sato', email: 'kenji@panasonic.co.jp', country: 'Japan', created_at: '2026-04-18 15:10:00' }
  ],
  orders: [
    { id: 101, customer_id: 1, order_date: '2026-05-01', total_amount: 150.50, status: 'Shipped' },
    { id: 102, customer_id: 2, order_date: '2026-05-12', total_amount: 3200.00, status: 'Processing' },
    { id: 103, customer_id: 2, order_date: '2026-05-20', total_amount: 45.00, status: 'Delivered' },
    { id: 104, customer_id: 3, order_date: '2026-05-25', total_amount: 89.99, status: 'Shipped' },
    { id: 105, customer_id: 4, order_date: '2026-06-02', total_amount: 540.00, status: 'Delivered' }
  ],
  order_items: [
    { id: 201, order_id: 101, product_id: 501, quantity: 2, price: 50.25 },
    { id: 202, order_id: 101, product_id: 502, quantity: 1, price: 50.00 },
    { id: 203, order_id: 102, product_id: 503, quantity: 1, price: 3200.00 },
    { id: 204, order_id: 103, product_id: 504, quantity: 1, price: 45.00 },
    { id: 205, order_id: 104, product_id: 505, quantity: 1, price: 89.99 },
    { id: 206, order_id: 105, product_id: 512, quantity: 4, price: 135.00 }
  ]
};

// Generates the SQL statement dynamically based on visual builder state
export const compileQueryToSql = (state: VisualQueryState): string => {
  if (!state.fromTable) return '-- Configure a target query base on the Schema card above --';

  const selectColumns = state.fields.length > 0
    ? state.fields.map(f => {
        let fieldStr = f.aggregate ? `${f.aggregate}(${f.table}.${f.column})` : `${f.table}.${f.column}`;
        if (f.alias) {
          fieldStr += ` AS ${f.alias}`;
        }
        return fieldStr;
      }).join(',\n  ')
    : `${state.fromTable}.*`;

  let sql = `SELECT\n  ${selectColumns}\nFROM ${state.fromTable}`;

  if (state.joins && state.joins.length > 0) {
    const joinsStr = state.joins.map(j => {
      return `\n${j.type} ${j.rightTable} ON ${j.leftTable}.${j.leftColumn} = ${j.rightTable}.${j.rightColumn}`;
    }).join('');
    sql += joinsStr;
  }

  if (state.filters && state.filters.length > 0) {
    const filtersStr = state.filters.map((f, idx) => {
      const isNull = f.operator === 'IS NULL';
      const formattedVal = isNull ? '' : (isNaN(Number(f.value)) ? `'${f.value}'` : f.value);
      const condition = isNull ? `${f.table}.${f.column} IS NULL` : `${f.table}.${f.column} ${f.operator} ${formattedVal}`;
      
      if (idx === 0) {
        return `\nWHERE ${condition}`;
      } else {
        return ` ${f.logic} ${condition}`;
      }
    }).join('');
    sql += filtersStr;
  }

  if (state.groupBy && state.groupBy.length > 0) {
    sql += `\nGROUP BY ${state.groupBy.join(', ')}`;
  } else if (state.fields.some(f => f.aggregate)) {
    // Implicit group by for selected standard fields
    const normalFields = state.fields.filter(f => !f.aggregate).map(f => `${f.table}.${f.column}`);
    if (normalFields.length > 0) {
      sql += `\nGROUP BY ${Array.from(new Set(normalFields)).join(', ')}`;
    }
  }

  if (state.orderBy && state.orderBy.length > 0) {
    const orderStr = state.orderBy.map(o => `${o.table}.${o.column} ${o.direction}`).join(', ');
    sql += `\nORDER BY ${orderStr}`;
  }

  if (state.limit) {
    sql += `\nLIMIT ${state.limit}`;
  }

  return sql + ';';
};

export default function QueryConsole({
  tables,
  queryState,
  onSendEmailResults,
  onSaveQueryToDrive,
  isWorkspaceConnected
}: QueryConsoleProps) {
  const [compiledSql, setCompiledSql] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [manualQueryEditMode, setManualQueryEditMode] = useState(false);
  const [manualSqlText, setManualSqlText] = useState('');

  // Local virtual database state
  const [virtualDb, setVirtualDb] = useState<Record<string, Array<Record<string, any>>>>(DEFAULT_MOCK_DATA);
  const [showDataEditorTab, setShowDataEditorTab] = useState<string | null>(null);
  const [customDataRowsText, setCustomDataRowsText] = useState('');

  // Query Results States
  const [executionResult, setExecutionResult] = useState<{ columns: string[]; rows: any[]; error: string | null }>({
    columns: [],
    rows: [],
    error: null
  });
  const [queryExecutionTime, setQueryExecutionTime] = useState(0);

  // Re-compile SQL whenever visual query parameters mutate
  useEffect(() => {
    const sql = compileQueryToSql(queryState);
    setCompiledSql(sql);
    setManualSqlText(sql);
  }, [queryState]);

  // Handle updates to virtual tables when parsed schemas change
  useEffect(() => {
    // Add custom structures for user-uploaded custom tables if they don't already exist
    const updatedDb = { ...virtualDb };
    let hasChanges = false;
    
    tables.forEach(t => {
      if (!updatedDb[t.name]) {
        // Build mock entries automatically
        const mockRows: any[] = [];
        for (let idx = 1; idx <= 3; idx++) {
          const row: any = {};
          t.columns.forEach(col => {
            if (col.primaryKey) row[col.name] = idx;
            else if (col.foreignKey) row[col.name] = idx; // simple correlation
            else if (col.type.includes('INT')) row[col.name] = idx * 10;
            else if (col.type.includes('DECIMAL')) row[col.name] = (idx * 15.5).toFixed(2);
            else if (col.type.toLowerCase().includes('date') || col.type.toLowerCase().includes('time')) {
              row[col.name] = '2026-06-07';
            } else if (col.type.includes('BOOLEAN')) row[col.name] = true;
            else row[col.name] = `${col.name}_mock_${idx}`;
          });
          mockRows.push(row);
        }
        updatedDb[t.name] = mockRows;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setVirtualDb(updatedDb);
    }
  }, [tables]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(manualQueryEditMode ? manualSqlText : compiledSql);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  /**
   * Virtual Relational Query Simulation Engine. Evaluates visual state directly
   * across mock virtual datasets arrays to guarantee absolute physical execution.
   */
  const handleExecuteMockQuery = () => {
    const start = performance.now();
    
    if (!queryState.fromTable) {
      setExecutionResult({ columns: [], rows: [], error: 'Select a query target base table first.' });
      return;
    }

    try {
      if (manualQueryEditMode) {
        // Simulated parser for manual queries triggers basic validations
        const mClean = manualSqlText.trim().replace(/\s+/g, ' ').toUpperCase();
        if (!mClean.startsWith('SELECT')) {
          throw new Error('Simulation syntax block: Queries must start with a SELECT clause.');
        }
        if (!mClean.includes('FROM')) {
          throw new Error('Simulation syntax block: Query must define a FROM source target.');
        }
      }

      // Step 1: Base table fetch
      const baseTableName = queryState.fromTable;
      const baseDataset = virtualDb[baseTableName];
      
      if (!baseDataset) {
        throw new Error(`Data Simulation Exception: Local mock dataset for table "${baseTableName}" is empty or not configured. Define mock rows in the Data Editor panel below.`);
      }

      // Deep copy rows and qualify names
      let rowResults = baseDataset.map(r => {
        const qualified: Record<string, any> = {};
        Object.keys(r).forEach(k => {
          qualified[`${baseTableName}.${k}`] = r[k];
        });
        return qualified;
      });

      // Step 2: Multi JOINS evaluation
      if (queryState.joins && queryState.joins.length > 0) {
        queryState.joins.forEach(join => {
          const rTable = join.rightTable;
          const rDataset = virtualDb[rTable];
          if (!rDataset) {
            throw new Error(`JOIN simulation failed: Table "${rTable}" has no mock data loaded.`);
          }

          const nextRowResults: any[] = [];
          
          rowResults.forEach(lRow => {
            // Find matches in right tables
            const matches = rDataset.filter(rRow => {
              const leftVal = lRow[`${join.leftTable}.${join.leftColumn}`];
              const rightVal = rRow[join.rightColumn];
              return String(leftVal) === String(rightVal);
            });

            if (matches.length > 0) {
              matches.forEach(m => {
                const combined = { ...lRow };
                Object.keys(m).forEach(k => {
                  combined[`${rTable}.${k}`] = m[k];
                });
                nextRowResults.push(combined);
              });
            } else if (join.type === 'LEFT JOIN') {
              // Null filled columns matching target
              const combined = { ...lRow };
              const rTableObj = tables.find(t => t.name === rTable);
              if (rTableObj) {
                rTableObj.columns.forEach(col => {
                  combined[`${rTable}.${col.name}`] = null;
                });
              }
              nextRowResults.push(combined);
            }
          });

          rowResults = nextRowResults;
        });
      }

      // Step 3: Evaluate Filters (WHERE)
      if (queryState.filters && queryState.filters.length > 0) {
        rowResults = rowResults.filter(row => {
          let rowCriteriaMatches = true;
          
          queryState.filters.forEach((f, idx) => {
            const qualifiedFld = `${f.table}.${f.column}`;
            const rowVal = row[qualifiedFld];
            let cellMatch = false;

            if (f.operator === 'IS NULL') {
              cellMatch = rowVal === null || rowVal === undefined;
            } else {
              const compVal = f.value;
              
              if (f.operator === '=') {
                cellMatch = String(rowVal).toLowerCase() === compVal.toLowerCase();
              } else if (f.operator === '!=') {
                cellMatch = String(rowVal).toLowerCase() !== compVal.toLowerCase();
              } else if (f.operator === 'LIKE') {
                const wild = compVal.toLowerCase().replace(/%/g, '');
                cellMatch = String(rowVal).toLowerCase().includes(wild);
              } else if (f.operator === '>') {
                cellMatch = Number(rowVal) > Number(compVal);
              } else if (f.operator === '<') {
                cellMatch = Number(rowVal) < Number(compVal);
              } else if (f.operator === 'IN') {
                const terms = compVal.split(',').map(t => t.trim().toLowerCase());
                cellMatch = terms.includes(String(rowVal).toLowerCase());
              }
            }

            if (idx === 0) {
              rowCriteriaMatches = cellMatch;
            } else {
              if (f.logic === 'AND') {
                rowCriteriaMatches = rowCriteriaMatches && cellMatch;
              } else {
                rowCriteriaMatches = rowCriteriaMatches || cellMatch;
              }
            }
          });

          return rowCriteriaMatches;
        });
      }

      // Step 4: Perform Groupings and aggregate evaluations
      const hasAggregates = queryState.fields.some(f => f.aggregate);
      let outputRows: any[] = [];

      if (hasAggregates) {
        // Group by columns set or implicit
        const activeGroupByKeys = queryState.groupBy.length > 0 
          ? queryState.groupBy 
          : queryState.fields.filter(f => !f.aggregate).map(f => `${f.table}.${f.column}`);

        const groupBuckets: Record<string, any[]> = {};
        
        rowResults.forEach(row => {
          const bucketKey = activeGroupByKeys.map(k => String(row[k])).join('||');
          if (!groupBuckets[bucketKey]) {
            groupBuckets[bucketKey] = [];
          }
          groupBuckets[bucketKey].push(row);
        });

        // Compute aggregate metrics
        Object.keys(groupBuckets).forEach(bKey => {
          const groupRows = groupBuckets[bKey];
          const calculatedRow: Record<string, any> = {};

          // Propagate normal group keys
          activeGroupByKeys.forEach(k => {
            calculatedRow[k] = groupRows[0][k];
          });

          queryState.fields.forEach(f => {
            const qualified = `${f.table}.${f.column}`;
            const keyOut = f.alias || (f.aggregate ? `${f.aggregate.toLowerCase()}_${f.column}` : qualified);

            if (f.aggregate) {
              const vals = groupRows.map(r => Number(r[qualified])).filter(v => !isNaN(v));
              
              if (f.aggregate === 'COUNT') {
                calculatedRow[keyOut] = groupRows.length;
              } else if (f.aggregate === 'SUM') {
                calculatedRow[keyOut] = vals.reduce((sum, current) => sum + current, 0);
              } else if (f.aggregate === 'AVG') {
                calculatedRow[keyOut] = vals.length > 0 ? (vals.reduce((sum, current) => sum + current, 0) / vals.length).toFixed(2) : 0;
              } else if (f.aggregate === 'MIN') {
                calculatedRow[keyOut] = vals.length > 0 ? Math.min(...vals) : 0;
              } else if (f.aggregate === 'MAX') {
                calculatedRow[keyOut] = vals.length > 0 ? Math.max(...vals) : 0;
              }
            } else {
              // Standard non aggregate column
              calculatedRow[keyOut] = groupRows[0][qualified];
            }
          });

          outputRows.push(calculatedRow);
        });
      } else {
        // Map normal selected fields or fallback to selects *
        rowResults.forEach(row => {
          const mappedRow: Record<string, any> = {};
          if (queryState.fields.length > 0) {
            queryState.fields.forEach(f => {
              const keyOut = f.alias || `${f.table}.${f.column}`;
              mappedRow[keyOut] = row[`${f.table}.${f.column}`];
            });
          } else {
            // Select all columns across active query
            Object.keys(row).forEach(k => {
              mappedRow[k] = row[k];
            });
          }
          outputRows.push(mappedRow);
        });
      }

      // Step 5: Sorting
      if (queryState.orderBy && queryState.orderBy.length > 0) {
        outputRows.sort((a, b) => {
          for (const ord of queryState.orderBy) {
            const colKey = ord.table ? `${ord.table}.${ord.column}` : ord.column;
            // Use alias fallback if present
            const matchedSel = queryState.fields.find(f => f.table === ord.table && f.column === ord.column);
            const keyInRow = (matchedSel && matchedSel.alias) ? matchedSel.alias : colKey;

            const valA = a[keyInRow];
            const valB = b[keyInRow];
            
            if (valA === undefined || valB === undefined) continue;

            const isNum = !isNaN(Number(valA)) && !isNaN(Number(valB));
            let compareRes = 0;

            if (isNum) {
              compareRes = Number(valA) - Number(valB);
            } else {
              compareRes = String(valA).localeCompare(String(valB));
            }

            if (compareRes !== 0) {
              return ord.direction === 'ASC' ? compareRes : -compareRes;
            }
          }
          return 0;
        });
      }

      // Step 6: Offset LIMIT check
      if (queryState.limit && outputRows.length > queryState.limit) {
        outputRows = outputRows.slice(0, queryState.limit);
      }

      // Compile columns header lists
      const columns = outputRows.length > 0 ? Object.keys(outputRows[0]) : [];

      setExecutionResult({
        columns,
        rows: outputRows,
        error: null
      });

      const duration = performance.now() - start;
      setQueryExecutionTime(parseFloat(duration.toFixed(1)));
    } catch (e: any) {
      console.error(e);
      setExecutionResult({ columns: [], rows: [], error: e.message || 'Execution simulation error' });
    }
  };

  // Run automatically when dependencies or visual parameters update to guarantee fresh records
  useEffect(() => {
    if (queryState.fromTable) {
      handleExecuteMockQuery();
    }
  }, [queryState, virtualDb]);

  // Support local direct CSV download
  const handleDownloadCsv = () => {
    if (executionResult.rows.length === 0) return;
    const headers = executionResult.columns.join(',');
    const body = executionResult.rows.map(row => 
      executionResult.columns.map(col => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + '\n' + body;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sql_query_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert current state results into gorgeous email report
  const handleEmailResultTrigger = () => {
    const querySqlStr = manualQueryEditMode ? manualSqlText : compiledSql;
    
    // Construct HTML Email body
    let rowsHtml = '';
    executionResult.rows.forEach(r => {
      rowsHtml += `<tr style="border-bottom: 1px solid #ddd;">`;
      executionResult.columns.forEach(col => {
        rowsHtml += `<td style="padding: 8px; font-family: monospace; font-size: 12px; color: #333;">${r[col] !== null ? String(r[col]) : 'NULL'}</td>`;
      });
      rowsHtml += `</tr>`;
    });

    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
        <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 8px; font-family: sans-serif;">
          📊 SQL Query Production Execution Report
        </h2>
        <p style="font-size: 13px; color: #555; leading-normal: 1.5;">
          This report contains dynamic SQL structures built and simulated in the <strong>SQL Query Workspace</strong>.
        </p>
        
        <div style="background-color: #f7f9fa; border-left: 4px solid #10b981; padding: 12px; margin: 15px 0;">
          <h4 style="margin: 0 0 8px 0; color: #333; font-size: 12px; text-transform: uppercase;">Generated SQL Statement:</h4>
          <pre style="margin: 0; font-family: monospace; font-size: 12px; color: #111; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;">${querySqlStr}</pre>
        </div>

        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; font-size: 14px; margin-top: 20px;">
          QueryResult Dataset Preview (${executionResult.rows.length} rows)
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #ddd; text-align: left;">
          <thead>
            <tr style="background-color: #f1f3f5; border-bottom: 2px solid #ddd;">
              ${executionResult.columns.map(c => `<th style="padding: 8px; font-weight: bold; font-size: 11px; text-transform: uppercase; color: #495057;">${c}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="10" style="padding:15px; text-align:center; color:#888;">No output values</td></tr>'}
          </tbody>
        </table>

        <footer style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 12px; font-size: 11px; color: #999;">
          Sent securely via integrated Google accounts using Meadow Lakehouse Core Services.
        </footer>
      </div>
    `;

    onSendEmailResults('Visual SQL Builder Code Export', bodyHtml);
  };

  const handleSaveToDriveTrigger = () => {
    const sqlContent = manualQueryEditMode ? manualSqlText : compiledSql;
    const fileNameInput = prompt('Enter a file name for your SQL Query document:', `query_${queryState.fromTable || 'unnamed'}.sql`);
    if (fileNameInput) {
      onSaveQueryToDrive(fileNameInput, sqlContent);
    }
  };

  // Launch text modal editor for fine-tuning mock records in custom parsed schemas
  const handleOpenMockDataManager = (tableName: string) => {
    setShowDataEditorTab(tableName);
    const existing = virtualDb[tableName] || [];
    setCustomDataRowsText(JSON.stringify(existing, null, 2));
  };

  const handleSaveCustomMockData = () => {
    if (!showDataEditorTab) return;
    try {
      const parsedData = JSON.parse(customDataRowsText);
      if (!Array.isArray(parsedData)) {
        throw new Error('Data rows must reside inside a JSON list format standard [ { ... }, { ... } ]');
      }
      setVirtualDb({
        ...virtualDb,
        [showDataEditorTab]: parsedData
      });
      setShowDataEditorTab(null);
    } catch (err: any) {
      alert(`Invalid format error: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* COMS AND SQL SCRIPT PLAYGROUND PANEL (COL 1 & 2) */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* COMPILED SQL BOARD PANEL */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-850/50 overflow-hidden shadow-xl">
          <div className="bg-slate-950/80 px-5 py-3.5 border-b border-slate-850/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="text-emerald-500 w-4 h-4" />
              <span className="text-xs font-mono font-bold tracking-wider text-slate-300">Synchronized SQL Script Panel</span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setManualQueryEditMode(!manualQueryEditMode)}
                className={`px-2 py-1 text-[10px] font-mono rounded tracking-wide transition border ${
                  manualQueryEditMode 
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/35 font-bold' 
                    : 'bg-slate-900 text-slate-400 border-slate-850 hover:text-white'
                }`}
              >
                {manualQueryEditMode ? "Free Editing: ON" : "Visual Mode Lock"}
              </button>

              <button
                type="button"
                onClick={handleCopySql}
                className="p-1 px-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded text-[10px] font-mono text-slate-350 hover:text-white flex items-center gap-1 transition"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="p-1 relative">
            <textarea
              value={manualQueryEditMode ? manualSqlText : compiledSql}
              onChange={(e) => {
                if (manualQueryEditMode) setManualSqlText(e.target.value);
              }}
              readOnly={!manualQueryEditMode}
              className="w-full h-44 bg-slate-950/80 text-sm font-mono text-emerald-400 p-4 focus:outline-none resize-none leading-relaxed"
            />
            {!manualQueryEditMode && (
              <div className="absolute right-4 bottom-4 text-[9px] font-mono text-slate-600 bg-slate-900/80 border border-slate-850 px-2 py-0.5 rounded uppercase">
                Synced Dynamic Output
              </div>
            )}
          </div>

          <div className="bg-slate-950/40 px-5 py-3 border-t border-slate-850/50 flex flex-wrap gap-3 justify-between items-center text-xs">
            <span className="text-slate-500 font-mono">Simulate virtual table rows against local sandbox compilation engine?</span>
            
            <button
              onClick={handleExecuteMockQuery}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Query Simulation
            </button>
          </div>
        </div>

        {/* INTERMEDIATE EXECUTION RESULTS SET */}
        <div className="bg-slate-900/60 border border-slate-850/50 rounded-2xl overflow-hidden shadow-xl min-h-[220px] flex flex-col justify-between">
          
          <div className="bg-slate-950/80 px-5 py-3 border-b border-slate-850/40 flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-300">Sandbox Preview Engine Outlet</span>
            {!executionResult.error && (
              <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
                <span>Latency: <strong className="text-emerald-400 font-bold">{queryExecutionTime} ms</strong></span>
                <span>Output Queue count: <strong className="text-emerald-400 font-bold">{executionResult.rows.length} records</strong></span>
              </div>
            )}
          </div>

          {/* TABLE SCROLLER PORT */}
          <div className="flex-1 p-5 overflow-auto max-h-[280px] bg-slate-950/40">
            {executionResult.error ? (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-300 text-xs font-mono">
                🛑 Compile Exception: {executionResult.error}
              </div>
            ) : executionResult.rows.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-500 text-xs">
                <Database className="w-8 h-8 text-slate-800 mb-2" />
                Query returned empty result set or no query compiles. Configure elements.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-550 uppercase tracking-wider text-[10px]">
                      {executionResult.columns.map((col, idx) => (
                        <th key={idx} className="pb-2.5 font-bold font-mono pl-3">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/50">
                    {executionResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/30">
                        {executionResult.columns.map((col, colIdx) => (
                          <td key={colIdx} className="py-2.5 text-slate-300 pl-3">
                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-slate-650 italic">NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* COMPLIANCE TRIGGERS GATES */}
          {!executionResult.error && executionResult.rows.length > 0 && (
            <div className="bg-slate-950/40 px-5 py-3 border-t border-slate-850/50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-xs">
              <span className="text-slate-500 font-mono">Bridge final code metrics or data summaries?</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Local CSV File
                </button>

                <button
                  type="button"
                  onClick={handleSaveToDriveTrigger}
                  disabled={!isWorkspaceConnected}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-850 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  title={isWorkspaceConnected ? 'Save SQL file to Drive' : 'Sync workspace with Google Drive to enable Saving'}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  Save SQL to Drive
                </button>

                <button
                  type="button"
                  onClick={handleEmailResultTrigger}
                  disabled={!isWorkspaceConnected}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 transition"
                  title={isWorkspaceConnected ? 'Email outputs using Gmail API' : 'Sync workspace to unlock Email dispatch'}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Transmit results via Email
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* DETAILED DATASETS EDITOR DRAWER PANEL (COL 3) */}
      <div className="xl:col-span-1 space-y-6">
        
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 space-y-4">
          <div className="flex items-center gap-1.5">
            <Database className="w-4.5 h-4.5 text-yellow-500 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">Simulated Table Records</h3>
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            Update rows directly inside the virtual database engine state to see real-time query executions.
          </p>

          <div className="space-y-3">
            {Object.keys(virtualDb).map(tblName => (
              <div key={tblName} className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between text-xs font-mono">
                <div>
                  <strong className="text-slate-200 block text-[11px]">{tblName}</strong>
                  <span className="text-[10px] text-slate-550 block mt-0.5">{virtualDb[tblName].length} simulation rows loaded</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleOpenMockDataManager(tblName)}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] font-semibold text-emerald-400 border border-slate-850 hover:border-emerald-500/20 rounded-lg transition"
                >
                  Edit Data Rows
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* MODAL WORKSPACE DATA POPUP */}
        {showDataEditorTab && (
          <div className="fixed inset-0 z-50 bg-[#020704]/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 font-mono uppercase">Fine-Tune Mock Data for: "{showDataEditorTab}"</span>
                <button
                  type="button"
                  onClick={() => setShowDataEditorTab(null)}
                  className="text-slate-450 hover:text-white font-bold"
                >
                  ×
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-normal">
                Input mock rows in a dynamic JSON object lists representation. Keep identifiers consistent on your foreign joins.
              </p>

              <textarea
                value={customDataRowsText}
                onChange={(e) => setCustomDataRowsText(e.target.value)}
                className="w-full h-64 bg-slate-950 text-xs font-mono text-yellow-500 p-3 rounded-lg border border-slate-850 focused:outline-none focus:border-emerald-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDataEditorTab(null)}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-350 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomMockData}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black"
                >
                  Update Records
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
