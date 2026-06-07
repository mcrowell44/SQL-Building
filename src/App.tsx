/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Terminal, 
  Code, 
  Tag, 
  Layers, 
  Cloud, 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  CheckCircle, 
  Activity, 
  Globe, 
  BookOpen, 
  Share2, 
  Wand2,
  Trash2,
  Sparkles,
  Inbox,
  LogOut,
  Sliders,
  Check,
  Zap,
  Info,
  Send
} from 'lucide-react';
import { motion } from 'motion/react';
import { type Table, type Column, type SelectField, type JoinConfig, type FilterConfig, type OrderByConfig, type VisualQueryState } from './types';
import SchemaManager from './components/SchemaManager';
import VisualQueryBuilder from './components/VisualQueryBuilder';
import QueryConsole from './components/QueryConsole';
import WorkspaceIntegrations from './components/WorkspaceIntegrations';
import { sendGmailMessage } from './api';
import { type User } from 'firebase/auth';
import { initAuth } from './firebase';

const INITIAL_TABLES: Table[] = [
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
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'visual-workspace' | 'workspace-sync'>('visual-workspace');
  
  // Relational Database Tables State
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  
  // Google Auth Account Info
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // System Trace/Logs Feed State
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Local Standby Terminal online.`,
    `[${new Date().toLocaleTimeString()}] Base simulation tables active: customers, orders, order_items.`
  ]);

  // Visual Select Parameters for Dynamic SQL Query Builder State
  const [fromTable, setFromTable] = useState<string>('customers');
  const [fields, setFields] = useState<SelectField[]>([
    { id: 'sel_id', table: 'customers', column: 'id' },
    { id: 'sel_name', table: 'customers', column: 'name' },
    { id: 'sel_email', table: 'customers', column: 'email' },
    { id: 'sel_country', table: 'customers', column: 'country' }
  ]);
  const [joins, setJoins] = useState<JoinConfig[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState<OrderByConfig[]>([]);
  const [limit, setLimit] = useState<number>(30);

  // Trigger counters for sub-lists updates
  const [triggerGmailListRef, setTriggerGmailListRef] = useState(0);

  // Loading indicator for server-side parsing calls
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Interactive popup modals
  const [toastMessage, setToastMessage] = useState('');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailComposerContent, setEmailComposerContent] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [emailSubjectInput, setEmailSubjectInput] = useState('Workspace Report: SQL Query & Results Set');
  const [isSendingWorkspaceEmail, setIsSendingWorkspaceEmail] = useState(false);

  const addSystemLog = (text: string) => {
    setTerminalLogs(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev.slice(0, 45)]);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Restore existing credentials on page refresh automatically
  useEffect(() => {
    const unsubscribe = initAuth(
      (userInstance, accessToken) => {
        setUser(userInstance);
        setToken(accessToken);
        addSystemLog(`Authorized session restored securely for: ${userInstance.email}`);
      },
      () => {
        addSystemLog('Standby Node initialized. Sync Google account to unlock cloud files parsing.');
      }
    );
    return () => unsubscribe();
  }, []);

  // Visually inject joins triggered from ER diagram click
  const handleInjectErdJoinRelation = (leftTable: string, leftCol: string, rightTable: string, rightCol: string) => {
    // Check if join structure already exists
    const exists = joins.some(j => 
      (j.leftTable === leftTable && j.leftColumn === leftCol && j.rightTable === rightTable && j.rightColumn === rightCol) ||
      (j.leftTable === rightTable && j.leftColumn === rightCol && j.rightTable === leftTable && j.rightColumn === leftCol)
    );

    if (exists) {
      triggerToast('⚠️ JOIN definition already configured.');
      return;
    }

    const newJoin: JoinConfig = {
      id: `join_erd_${Date.now()}`,
      type: 'INNER JOIN',
      leftTable,
      leftColumn: leftCol,
      rightTable,
      rightColumn: rightCol
    };

    setJoins([...joins, newJoin]);
    addSystemLog(`🔗 Injected Join Connector: ${leftTable}.${leftCol} = ${rightTable}.${rightCol}`);
    triggerToast('🔗 JOIN rule injected successfully!');
  };

  // Import file content (SQL scripts or specs) from Drive list selectors
  const handleImportContentFromWorkspace = (fileContent: string, fileName: string) => {
    // Open workspace view
    setActiveTab('visual-workspace');
    addSystemLog(`📥 Loaded data block: "${fileName}"`);
    triggerToast(`Imported ${fileName} content! Parsing schema with Gemini...`);

    // Call parsing function directly behind the scenes to update active DB immediately
    triggerAISchemaParsing(fileContent, fileName);
  };

  // Trigger Gemini API Parser via server
  const triggerAISchemaParsing = async (codeText: string, docName: string) => {
    setIsLoadingAI(true);
    addSystemLog(`🤖 Querying server-side parsing models for: "${docName}"`);
    try {
      const res = await fetch('/api/parse-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeText, fileName: docName })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server rejected parsing request');
      }

      const data = await res.json();
      if (data.tables && data.tables.length > 0) {
        setTables(data.tables);
        setFromTable(data.tables[0].name);
        
        // Populate standard select fields for newly parsed tables for visual instant displays
        setFields(data.tables[0].columns.map(c => ({
          id: `${data.tables[0].name}_${c.name}_${Date.now()}`,
          table: data.tables[0].name,
          column: c.name
        })));
        setJoins([]);
        setFilters([]);
        setGroupBy([]);
        setOrderBy([]);

        addSystemLog(`✅ Successfully loaded ${data.tables.length} tables parsed from "${docName}" using Gemini!`);
        triggerToast(`🚀 AI compiled ${data.tables.length} tables from "${docName}"!`);
      } else {
        throw new Error('Parser model returned zero logical tables references');
      }
    } catch (err: any) {
      console.error(err);
      addSystemLog(`❌ AI Parsing Interrupted: ${err.message}`);
      triggerToast(`AI Parsing failed: ${err.message}`);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Handles Saving sql doc back to Google Drive (2-stage reliable create + patch binary PUT protocol)
  const handleSaveSqlToGoogleDrive = async (fileName: string, sqlContent: string) => {
    if (!token) return;
    addSystemLog(`💾 Initiating Google Drive transaction request for document: "${fileName}"`);
    triggerToast('Saving doc to Google Drive...');
    
    try {
      // Step 1: Create empty metadata document placeholder
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: fileName,
          mimeType: 'text/plain'
        })
      });

      if (!createRes.ok) {
        const errTxt = await createRes.text();
        throw new Error(`Create Metadata Aborted: ${errTxt}`);
      }

      const createdFileObj = await createRes.json();
      const newFileId = createdFileObj.id;

      // Step 2: PATCH binary payload data stream directly to created ID
      const mediaRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain'
        },
        body: sqlContent
      });

      if (!mediaRes.ok) {
        throw new Error('PUT Data Stream aborted by storage driver');
      }

      addSystemLog(`✅ Successfully saved documented schema query package to Drive. File ID: ${newFileId}`);
      triggerToast('🎉 SQL successfully saved to your Google Drive!');
    } catch (err: any) {
      console.error(err);
      addSystemLog(`❌ Save To Drive aborted: ${err.message}`);
      triggerToast(`Filing transaction discarded: ${err.message}`);
    }
  };

  // Pre-open email composer modal compiled with raw content ready
  const handleOpenEmailComposerPopup = (subject: string, htmlContent: string) => {
    setEmailComposerContent(htmlContent);
    setEmailSubjectInput(subject);
    if (user?.email) {
      setRecipientInput(user.email); // Auto preset recipient to user's address as a helpful default
    }
    setShowEmailComposer(true);
  };

  const handleSendGmailDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !recipientInput.trim()) return;

    setIsSendingWorkspaceEmail(true);
    addSystemLog(`📫 Contacting SMTP Gmail Relays for transmission dispatch...`);
    triggerToast('Sending SMTP mail package...');

    try {
      const isSent = await sendGmailMessage(token, recipientInput, emailSubjectInput, emailComposerContent);
      if (isSent) {
        addSystemLog(`✅ Successfully dispatched workspace email packet to recipient: ${recipientInput}`);
        triggerToast('🎉 Email dispatched successfully!');
        setShowEmailComposer(false);
        
        // Trigger list refresh of sent logs automatically
        setTriggerGmailListRef(prev => prev + 1);
      }
    } catch (err: any) {
      console.error(err);
      addSystemLog(`❌ Relays Interrupted: ${err.message}`);
      triggerToast(`SMTP mail rejected: ${err.message}`);
    } finally {
      setIsSendingWorkspaceEmail(false);
    }
  };

  // Compile active query parameters array for easier binding
  const activeQueryState: VisualQueryState = {
    fromTable,
    fields,
    joins,
    filters,
    groupBy,
    orderBy,
    limit
  };

  return (
    <div className="min-h-screen bg-[#070c19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* GLOBAL BANNER TOAST CONSOLE */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[100] bg-emerald-500 text-slate-950 px-5 py-3.5 rounded-xl shadow-2xl font-black flex items-center gap-2 border border-emerald-300 text-xs animate-bounce">
          <CheckCircle className="w-5 h-5 text-slate-950" />
          {toastMessage}
        </div>
      )}

      {/* WORKSPACE GMAIL CONSOLE MODAL CHUNK */}
      {showEmailComposer && (
        <div className="fixed inset-0 z-50 bg-[#02050f]/90 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleSendGmailDispatch} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-emerald-400 font-mono uppercase flex items-center gap-1.5">
                <Mail className="w-4.5 h-4.5" />
                Gmail Workspace Package Relay
              </span>
              <button
                type="button"
                onClick={() => setShowEmailComposer(false)}
                className="text-slate-450 hover:text-white font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">To (Recipient Email ID)</label>
                <input 
                  type="email" 
                  required
                  placeholder="recipient@gmail.com"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Subject</label>
                <input 
                  type="text" 
                  required
                  placeholder="Subject Line"
                  value={emailSubjectInput}
                  onChange={(e) => setEmailSubjectInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Rendered Email Payload Outlook:</span>
                <div className="bg-slate-950 text-slate-400 border border-slate-850 max-h-48 overflow-y-auto p-3 rounded-lg text-[10px] space-y-2">
                  <div className="border-b border-slate-900 pb-1 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <strong>SQL execution preview rows (HTML table formatting) included</strong>
                  </div>
                  <pre className="whitespace-pre-wrap leading-normal font-sans">
                    This email is automatically synchronized from your visual compiler. It includes the built SQL script and full query results table rows.
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEmailComposer(false)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-350 rounded-lg text-xs font-semibold"
              >
                Dismiss
              </button>
              <button
                type="submit"
                disabled={isSendingWorkspaceEmail}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 transition disabled:opacity-40"
              >
                {isSendingWorkspaceEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Transmitting SMTP...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Dispatch Email Packet
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* HEADER SECTION BANNER */}
      <header className="border-b border-slate-805 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-black tracking-tight text-white flex items-center gap-2">
              Visual SQL Query Creator & AI Parser <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/40">Workspace v1.2</span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              Engine context: <code className="text-indigo-400 font-mono text-[11px]">express.google-workspace-sync.v1</code>
            </p>
          </div>
        </div>

        {/* AUTH/SYNC STATUS BADGE */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono bg-slate-900 border border-slate-800 p-2 rounded-xl text-slate-300">
            <span className={`w-2.5 h-2.5 rounded-full inline-block ${token ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
            <span className="text-slate-400">Workspace Authorization:</span>
            <strong className={token ? 'text-emerald-400 font-bold' : 'text-slate-500 font-semibold'}>
              {token ? 'FULLY INTEGRATED' : 'STANDBY MODE'}
            </strong>
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE MODULES VIEWS */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* LEFT NAV PANEL ACCENTS */}
        <aside className="w-full lg:w-64 bg-slate-950 border-r border-slate-850 flex flex-row lg:flex-col justify-start p-3 gap-1 overflow-x-auto lg:overflow-x-visible">
          <div className="text-[10px] uppercase font-black text-slate-500 tracking-wider px-3 py-1.5 hidden lg:block font-mono">Workspace Boards</div>

          <button 
            onClick={() => setActiveTab('visual-workspace')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition lg:w-full ${activeTab === 'visual-workspace' ? 'bg-slate-900 text-slate-100 border border-slate-800' : 'text-slate-450 hover:text-slate-100 hover:bg-slate-900/40'}`}
          >
            <Database className="w-4 h-4 text-emerald-500" />
            SQL Query Workspace
          </button>

          <button 
            onClick={() => setActiveTab('workspace-sync')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition lg:w-full ${activeTab === 'workspace-sync' ? 'bg-slate-900 text-slate-100 border border-slate-800' : 'text-slate-450 hover:text-slate-100 hover:bg-slate-900/40'}`}
          >
            <Cloud className="w-4 h-4 text-indigo-400" />
            Integrations Settings
          </button>

          <div className="hidden lg:block border-t border-slate-850 my-4"></div>

          {/* DYNAMIC INFORMATION PANEL */}
          <div className="hidden lg:flex flex-col gap-2 p-3.5 bg-slate-900/80 rounded-xl border border-slate-850 text-xs leading-normal">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              AI Parser Core
            </span>
            <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
              Google Gemini is linked to auto-map SQL DDLs, Prisma models or schema definitions uploaded from your local directories or Google Drive into graphical visual cards!
            </p>
          </div>
        </aside>

        {/* MAIN WORKSPACE BOARD PANEL */}
        <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-[#0a1020] to-[#04060c]">
          
          {activeTab === 'visual-workspace' ? (
            <div className="space-y-6">
              
              {/* SYSTEM INFORMER BAR */}
              <div className="bg-slate-900/35 border border-slate-850 p-4 rounded-xl flex items-start gap-2.5 text-xs text-slate-400 leading-normal animate-in fade-in duration-150">
                <Info className="w-4 h-4 text-indigo-450 shrink-0 mt-0.5 animate-pulse" />
                <p>
                  Welcome to the multi-relational SQL Creator. Construct tables visually using the manual editor in the <span className="font-bold text-slate-200">Schema Dashboard</span>, upload raw schema files, or sync Drive file structures. Clicking fk join connections on the diagrams instantly configs join rules.
                </p>
              </div>

              {/* TASK 1: SCHEMA MANAGER BOARD CHUNK */}
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-slate-900/40 border-l-4 border-emerald-500 p-4 py-3 bg-[#03150c]/80 rounded-r-xl">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">Workspace Step 1: Manage Relational Schemas</h3>
                </div>
                <SchemaManager 
                  tables={tables}
                  setTables={setTables}
                  onAddToJoin={handleInjectErdJoinRelation}
                  activeFromTable={fromTable}
                  setActiveFromTable={setFromTable}
                  isLoadingAI={isLoadingAI}
                  setIsLoadingAI={setIsLoadingAI}
                />
              </motion.div>

              {/* TASK 2: VISUAL QUERY BUILDER INTERACTIVE COMPONENT CHUNK */}
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-slate-900/40 border-l-4 border-indigo-500 p-4 py-3 bg-[#0a0715]/80 rounded-r-xl">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">Workspace Step 2: Configure SQL Blocks Visually</h3>
                </div>
                <VisualQueryBuilder
                  tables={tables}
                  fromTable={fromTable}
                  setFromTable={setFromTable}
                  fields={fields}
                  setFields={setFields}
                  joins={joins}
                  setJoins={setJoins}
                  filters={filters}
                  setFilters={setFilters}
                  groupBy={groupBy}
                  setGroupBy={setGroupBy}
                  orderBy={orderBy}
                  setOrderBy={setOrderBy}
                  limit={limit}
                  setLimit={setLimit}
                />
              </motion.div>

              {/* TASK 3: TERMINAL QUERY CONSOLE GRAPHICS */}
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-slate-900/40 border-l-4 border-yellow-500 p-4 py-3 bg-[#171203]/85 rounded-r-xl">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">Workspace Step 3: Run Simulation & Share results</h3>
                </div>
                <QueryConsole
                  tables={tables}
                  queryState={activeQueryState}
                  onSendEmailResults={handleOpenEmailComposerPopup}
                  onSaveQueryToDrive={handleSaveSqlToGoogleDrive}
                  isWorkspaceConnected={!!token}
                />
              </motion.div>

            </div>
          ) : (
            
            // GOOGLE WORKSPACE CONNECTION PROFILE VIEWS
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <WorkspaceIntegrations 
                user={user}
                setUser={setUser}
                token={token}
                setToken={setToken}
                onImportDriveContent={handleImportContentFromWorkspace}
                onAddLog={addSystemLog}
                toast={triggerToast}
                triggerGmailListRef={triggerGmailListRef}
              />

              {/* SYSTEM IN-PROGRESS LOGS TERMINAL */}
              <div className="bg-slate-900 rounded-2xl border border-slate-850 p-5 mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Terminal className="text-emerald-500 w-4 h-4" />
                    Session Activity Auditor (Trace)
                  </span>
                  <button
                    type="button"
                    onClick={() => setTerminalLogs([`[${new Date().toLocaleTimeString()}] Auditor log array flushed.`])}
                    className="text-[10px] uppercase font-mono text-slate-500 hover:text-white"
                  >
                    Flush outputs
                  </button>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 max-h-60 overflow-y-auto space-y-2 font-mono text-[11px] text-emerald-400">
                  {terminalLogs.length === 0 ? (
                    <span className="text-slate-600 block italic">&gt; Trace cache empty.</span>
                  ) : (
                    terminalLogs.map((log, idx) => (
                      <div key={idx} className="block break-all leading-normal">
                        &gt; {log}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </motion.div>
          )}

        </main>

      </div>

      {/* BASE FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-850 px-6 py-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
        <span>© 2026 Visual SQL Engine Layouts • Workspace synced</span>
        <div className="flex gap-4">
          <span className="hover:text-slate-300 cursor-pointer text-indigo-400 font-bold">Google Drive & Gmail Verified APIs</span>
        </div>
      </footer>

    </div>
  );
}
