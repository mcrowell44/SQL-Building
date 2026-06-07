/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Database, 
  Upload, 
  FileCode, 
  Sparkles, 
  AlertCircle, 
  Settings, 
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  ChevronRight
} from 'lucide-react';
import { type Table, type Column } from '../types';

interface SchemaManagerProps {
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  onAddToJoin: (leftTable: string, leftCol: string, rightTable: string, rightCol: string) => void;
  activeFromTable: string;
  setActiveFromTable: (table: string) => void;
  isLoadingAI: boolean;
  setIsLoadingAI: (loading: boolean) => void;
}

// Pre-defined database templates for direct visual stimulation
const DATABASE_TEMPLATES = [
  {
    name: 'E-commerce (Standard)',
    description: 'Relational structure matching users, transactional orders, and order item metrics.',
    tables: [
      {
        name: 'customers',
        columns: [
          { name: 'id', type: 'INT', primaryKey: true, notNull: true },
          { name: 'name', type: 'VARCHAR(100)', primaryKey: false, notNull: true },
          { name: 'email', type: 'VARCHAR(255)', primaryKey: false, notNull: true },
          { name: 'country', type: 'VARCHAR(50)', primaryKey: false, notNull: false },
          { name: 'created_at', type: 'TIMESTAMP', primaryKey: false, notNull: true }
        ]
      },
      {
        name: 'orders',
        columns: [
          { name: 'id', type: 'INT', primaryKey: true, notNull: true },
          { name: 'customer_id', type: 'INT', primaryKey: false, notNull: true, foreignKey: { table: 'customers', column: 'id' } },
          { name: 'order_date', type: 'DATE', primaryKey: false, notNull: true },
          { name: 'total_amount', type: 'DECIMAL(10,2)', primaryKey: false, notNull: true },
          { name: 'status', type: 'VARCHAR(20)', primaryKey: false, notNull: true }
        ]
      },
      {
        name: 'order_items',
        columns: [
          { name: 'id', type: 'INT', primaryKey: true, notNull: true },
          { name: 'order_id', type: 'INT', primaryKey: false, notNull: true, foreignKey: { table: 'orders', column: 'id' } },
          { name: 'product_id', type: 'INT', primaryKey: false, notNull: true },
          { name: 'quantity', type: 'INT', primaryKey: false, notNull: true },
          { name: 'price', type: 'DECIMAL(10,2)', primaryKey: false, notNull: true }
        ]
      }
    ]
  },
  {
    name: 'Academic Platform',
    description: 'Courses lists, students enrolment tracking, and results grading matrix.',
    tables: [
      {
        name: 'students',
        columns: [
          { name: 'student_id', type: 'INT', primaryKey: true, notNull: true },
          { name: 'first_name', type: 'VARCHAR(50)', primaryKey: false, notNull: true },
          { name: 'last_name', type: 'VARCHAR(50)', primaryKey: false, notNull: true },
          { name: 'email', type: 'VARCHAR(100)', primaryKey: false, notNull: true }
        ]
      },
      {
        name: 'courses',
        columns: [
          { name: 'course_id', type: 'INT', primaryKey: true, notNull: true },
          { name: 'course_name', type: 'VARCHAR(100)', primaryKey: false, notNull: true },
          { name: 'credits', type: 'INT', primaryKey: false, notNull: true }
        ]
      },
      {
        name: 'enrolments',
        columns: [
          { name: 'enrol_id', type: 'INT', primaryKey: true, notNull: true },
          { name: 'student_id', type: 'INT', primaryKey: false, notNull: true, foreignKey: { table: 'students', column: 'student_id' } },
          { name: 'course_id', type: 'INT', primaryKey: false, notNull: true, foreignKey: { table: 'courses', column: 'course_id' } },
          { name: 'enrol_date', type: 'DATE', primaryKey: false, notNull: true },
          { name: 'grade', type: 'VARCHAR(2)', primaryKey: false, notNull: false }
        ]
      }
    ]
  }
];

export default function SchemaManager({
  tables,
  setTables,
  onAddToJoin,
  activeFromTable,
  setActiveFromTable,
  isLoadingAI,
  setIsLoadingAI
}: SchemaManagerProps) {
  const [pastedCode, setPastedCode] = useState('');
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Custom interactive Table creator state
  const [showManualTableForm, setShowManualTableForm] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [manualColumns, setManualColumns] = useState<Column[]>([
    { name: 'id', type: 'INT', primaryKey: true, notNull: true }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger server-side AI parsing via Express
  const handleParseCode = async (codeText: string, name: string = 'schema.sql') => {
    if (!codeText.trim()) return;
    setIsLoadingAI(true);
    setParsingError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/parse-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: codeText, fileName: name })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Server error parsing schema');
      }

      const data = await res.json();
      if (data.tables && data.tables.length > 0) {
        setTables(data.tables);
        if (!activeFromTable || !data.tables.some((t: Table) => t.name === activeFromTable)) {
          setActiveFromTable(data.tables[0].name);
        }
        setSuccessMsg(`Successfully extracted ${data.tables.length} tables from uploaded code via Google Gemini!`);
        setPastedCode('');
      } else {
        throw new Error('AI parser returned no logical database tables. Try providing SQL CREATE script, prisma code, class structures, or structured lists.');
      }
    } catch (err: any) {
      console.error(err);
      setParsingError(err.message || 'Error occurred contacting schema parsing model');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleParseCode(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleParseCode(content, file.name);
    };
    reader.readAsText(file);
  };

  // Preset configuration loaders
  const loadPresetTemplate = (presetIndex: number) => {
    const template = DATABASE_TEMPLATES[presetIndex];
    setTables(template.tables);
    setActiveFromTable(template.tables[0].name);
    setSuccessMsg(`Loaded database preset template: ${template.name}`);
    setParsingError(null);
  };

  // Add Column to list within inline interactive editor
  const handleAddManualColumn = () => {
    setManualColumns([...manualColumns, { name: '', type: 'VARCHAR(255)', primaryKey: false, notNull: false }]);
  };

  // Remove Column within manual creator
  const handleRemoveManualColumn = (index: number) => {
    setManualColumns(manualColumns.filter((_, idx) => idx !== index));
  };

  const handleCreateManualTable = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newTableName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanName) {
      alert('Specify a table name.');
      return;
    }

    if (tables.some(t => t.name === cleanName)) {
      alert('Table with this name acts as existing target.');
      return;
    }

    const validatedCols = manualColumns
      .map(c => ({
        ...c,
        name: c.name.trim().toLowerCase().replace(/\s+/g, '_')
      }))
      .filter(c => c.name);

    if (validatedCols.length === 0) {
      alert('Table must host at least 1 validated column.');
      return;
    }

    const newTable: Table = {
      name: cleanName,
      columns: validatedCols
    };

    const updatedTables = [...tables, newTable];
    setTables(updatedTables);
    if (!activeFromTable) {
      setActiveFromTable(cleanName);
    }

    // Reset forms
    setShowManualTableForm(false);
    setNewTableName('');
    setManualColumns([{ name: 'id', type: 'INT', primaryKey: true, notNull: true }]);
    setSuccessMsg(`Created custom visual table: ${cleanName}`);
  };

  const handleDeleteTable = (tableName: string) => {
    const nextList = tables.filter(t => t.name !== tableName);
    setTables(nextList);
    if (activeFromTable === tableName && nextList.length > 0) {
      setActiveFromTable(nextList[0].name);
    } else if (nextList.length === 0) {
      setActiveFromTable('');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* COLUMN 1: INTERACTIVE DATABASE UPLOADER & PRESETS */}
      <div className="xl:col-span-1 space-y-6">
        
        {/* DRAG AND DROP FILE UPLOAD WRAPPER */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition ${
            isDragging 
              ? 'border-emerald-400 bg-emerald-950/20' 
              : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
          }`}
        >
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".sql,.txt,.prisma,.ts,.tsx,.json,.py,.csv"
            className="hidden"
          />
          <Upload className="mx-auto w-10 h-10 text-emerald-400 mb-3" />
          <h3 className="text-sm font-bold text-slate-100">Upload Database Files</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Drag files containing SQL scripts, SQLAlchemy/Prisma schemas, classes, data requirements, or click to browse.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
          >
            Browse Files
          </button>
        </div>

        {/* COPY-PASTE CODE BOX OR TEXT MAPPING */}
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-500" />
              Analyze Code or Specifications
            </h3>
            <span className="text-[10px] text-yellow-500 font-mono font-bold">GEMINI CO-ENGINE</span>
          </div>

          <textarea
            value={pastedCode}
            onChange={(e) => setPastedCode(e.target.value)}
            placeholder="Paste your code definitions here... E.g.
CREATE TABLE members (
  member_id INT PRIMARY KEY,
  join_date DATE,
  referrer_id INT REFERENCES members(member_id)
);"
            className="w-full h-36 bg-slate-950/80 border border-slate-850 rounded-xl p-3 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
          />

          <button
            type="button"
            onClick={() => handleParseCode(pastedCode)}
            disabled={isLoadingAI || !pastedCode.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl transition disabled:opacity-50"
          >
            {isLoadingAI ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Gemini Parsing Schema...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Schema with AI
              </>
            )}
          </button>
        </div>

        {/* SCHEMAS PRESETS */}
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 space-y-4">
          <h3 className="text-sm font-bold text-slate-100">Live Workspace Template Presets</h3>
          <p className="text-xs text-slate-400 leading-normal">
            No schemas upload handy? Choose an active sandbox preset to visually configure metrics instantly.
          </p>
          <div className="space-y-3">
            {DATABASE_TEMPLATES.map((tpl, idx) => (
              <div 
                key={idx}
                onClick={() => loadPresetTemplate(idx)}
                className="group cursor-pointer p-3 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 hover:border-emerald-500/30 rounded-xl transition text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 transition">{tpl.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  {tpl.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* COLUMN 2 & 3: ER DIAGRAM AND LIVE SCHEMA EXPLORER */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* PROGRESS INFOS OR MESSAGES */}
        {parsingError && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-300 text-xs font-mono flex items-start gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold">Schema Parsing Interrupted</strong>
              <p>{parsingError}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-emerald-400 text-xs font-sans flex items-start gap-2">
            <Plus className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold">Workspace Notification</strong>
              <p>{successMsg}</p>
            </div>
          </div>
        )}

        {/* SCHEMAS CONTROLLERS CONTAINER */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-850/50 p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                <Database className="text-emerald-400 w-5 h-5" />
                Entity Relationship Diagram & Virtual Schema Dashboard
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Interact with the dynamic canvas. Set the query source table, and click on foreign relations to configure visual joins instantly.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowManualTableForm(!showManualTableForm)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Custom Table
            </button>
          </div>

          {/* MANUAL TABLE EDITOR DRAWPORT */}
          {showManualTableForm && (
            <form onSubmit={handleCreateManualTable} className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 animate-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-emerald-400 uppercase font-mono tracking-wider">Configure Custom Visual Table</h4>
                <button
                  type="button"
                  onClick={() => setShowManualTableForm(false)}
                  className="text-slate-550 text-xs font-bold"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono block mb-1">Table Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. transactions"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono text-emerald-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Define Columns</span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {manualColumns.map((col, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 pr-1">
                      <div className="md:col-span-4">
                        <input 
                          type="text" 
                          placeholder="column_name"
                          required
                          value={col.name}
                          onChange={(e) => {
                            const updated = [...manualColumns];
                            updated[idx].name = e.target.value;
                            setManualColumns(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <select
                          value={col.type}
                          onChange={(e) => {
                            const updated = [...manualColumns];
                            updated[idx].type = e.target.value;
                            setManualColumns(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono"
                        >
                          <option value="INT">INT</option>
                          <option value="VARCHAR(255)">VARCHAR(255)</option>
                          <option value="TEXT">TEXT</option>
                          <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                          <option value="BOOLEAN">BOOLEAN</option>
                          <option value="DATE">DATE</option>
                          <option value="TIMESTAMP">TIMESTAMP</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 flex items-center gap-1 text-xs">
                        <input 
                          type="checkbox"
                          id={`pk-${idx}`}
                          checked={col.primaryKey}
                          onChange={(e) => {
                            const updated = [...manualColumns];
                            updated[idx].primaryKey = e.target.checked;
                            if (e.target.checked) updated[idx].notNull = true;
                            setManualColumns(updated);
                          }}
                        />
                        <label htmlFor={`pk-${idx}`} className="text-[10px] text-slate-400 font-mono select-none">PK</label>
                      </div>
                      <div className="md:col-span-2 flex items-center gap-1 text-xs">
                        <input 
                          type="checkbox"
                          id={`nn-${idx}`}
                          checked={col.notNull}
                          onChange={(e) => {
                            const updated = [...manualColumns];
                            updated[idx].notNull = e.target.checked;
                            setManualColumns(updated);
                          }}
                        />
                        <label htmlFor={`nn-${idx}`} className="text-[10px] text-slate-400 font-mono select-none">NotNull</label>
                      </div>
                      <div className="md:col-span-1 text-right">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveManualColumn(idx)}
                            className="p-1 px-2 text-rose-500 hover:text-rose-455 hover:bg-slate-900 rounded"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleAddManualColumn}
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-850 text-[11px] text-slate-350 rounded border border-slate-800"
                  >
                    + Add Column
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-500 text-slate-950 font-black text-xs rounded-lg hover:bg-emerald-400 transition"
                  >
                    Assemble Virtual Table
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* VISUAL ERD CANVAS */}
          {tables.length === 0 ? (
            <div className="bg-slate-950/80 border border-slate-850 p-10 rounded-2xl text-center space-y-3">
              <Database className="w-10 h-10 text-slate-700 mx-auto" />
              <p className="text-slate-400 text-xs">
                No active relational database schemas loaded. Use the controls on the left to upload code schemas, paste specifications, or choose a sandbox template!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tables.map((table) => {
                const isFrom = activeFromTable === table.name;
                return (
                  <div 
                    key={table.name}
                    className={`relative rounded-xl border p-4 bg-slate-950 flex flex-col justify-between transition-all ${
                      isFrom 
                        ? 'ring-2 ring-emerald-500 border-transparent shadow-lg shadow-emerald-500/5' 
                        : 'border-slate-850 hover:border-slate-700'
                    }`}
                  >
                    {/* TABLE HEAD CARD */}
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                        <div className="flex items-center gap-1.5">
                          <Database className={`w-4 h-4 ${isFrom ? 'text-emerald-500' : 'text-slate-500'}`} />
                          <span className="text-xs font-bold text-slate-100 font-mono tracking-wider">{table.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isFrom ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-black tracking-wider">
                              Query Source
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveFromTable(table.name)}
                              className="text-[10px] bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-650 px-2 py-0.5 rounded uppercase tracking-wider transition"
                            >
                              Set Primary Source
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteTable(table.name)}
                            className="text-slate-500 hover:text-rose-500 p-0.5 transition"
                            title="Remove Table"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* DISPLAY ROW COLUMNS COLUMNS */}
                      <div className="space-y-1.5">
                        {table.columns.map((col) => (
                          <div key={col.name} className="flex justify-between items-center text-[11px] font-mono hover:bg-slate-900/50 p-1 rounded">
                            <div className="flex items-center gap-1.5">
                              {col.primaryKey && (
                                <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1 rounded scale-90 font-bold" title="Primary Key">
                                  PK
                                </span>
                              )}
                              {col.foreignKey && (
                                <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1 rounded scale-90 font-bold" title="Foreign Key">
                                  FK
                                </span>
                              )}
                              <span className="text-slate-300 font-medium">{col.name}</span>
                            </div>
                            <span className="text-slate-500 text-[10px]">{col.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* FOREIGN RELATIONS MAPPINGS CONTAINER */}
                    {table.columns.some(col => col.foreignKey) && (
                      <div className="mt-4 pt-3 border-t border-slate-900 space-y-1.5">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block">Foreign Join Connections:</span>
                        {table.columns.map((col) => {
                          if (!col.foreignKey) return null;
                          const fk = col.foreignKey;
                          return (
                            <div 
                              key={col.name}
                              onClick={() => onAddToJoin(table.name, col.name, fk.table, fk.column)}
                              className="group flex items-center justify-between p-1 px-2 rounded bg-slate-900/40 border border-slate-800/50 hover:border-emerald-500/30 cursor-pointer transition text-[10px] font-mono text-slate-400"
                              title="Click to visually inject JOIN connection into builder"
                            >
                              <span className="truncate">{col.name} ➔ {fk.table}.{fk.column}</span>
                              <span className="text-emerald-500 opacity-0 group-hover:opacity-100 font-bold flex items-center gap-0.5 transition whitespace-nowrap">
                                + Inject Join
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
