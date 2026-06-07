/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  FolderOpen, 
  Search, 
  Mail, 
  Terminal, 
  Database, 
  RefreshCw,
  Send,
  Sparkles,
  CheckCircle,
  FileCode,
  Inbox,
  Lock,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { type DriveFile, type GmailThread } from '../types';
import { searchDriveFiles, fetchDriveFileContent, fetchGmailThreads, sendGmailMessage } from '../api';
import { googleSignIn, logout, type initAuth } from '../firebase';
import { type User } from 'firebase/auth';

interface WorkspaceIntegrationsProps {
  user: User | null;
  setUser: (user: User | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
  onImportDriveContent: (content: string, fileName: string) => void;
  onAddLog: (log: string) => void;
  toast: (msg: string) => void;
  triggerGmailListRef: number; // Increment counter trigger updates
}

export default function WorkspaceIntegrations({
  user,
  setUser,
  token,
  setToken,
  onImportDriveContent,
  onAddLog,
  toast,
  triggerGmailListRef
}: WorkspaceIntegrationsProps) {
  
  // Google Drive & Gmail State
  const [driveSearchQuery, setDriveSearchQuery] = useState('');
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [gmailThreads, setGmailThreads] = useState<GmailThread[]>([]);
  const [isLoadingGmail, setIsLoadingGmail] = useState(false);

  // Email Composer Modal/State
  const [recipient, setRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('SQL code, schema report, results array.');
  const [emailNote, setEmailNote] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Firebase auth status
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        onAddLog(`✅ Synchronized Google workspace with client: ${result.user.email}`);
        toast('OAuth Workspace Connection established!');
      }
    } catch (err: any) {
      console.error(err);
      toast('Login popup failed or focus aborted.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setDriveFiles([]);
      setGmailThreads([]);
      onAddLog('❌ Revoked integration session tokens.');
      toast('Workspace disconnected.');
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Drive Search API
  const handleSearchDrive = async () => {
    if (!token) return;
    setIsLoadingDrive(true);
    try {
      const files = await searchDriveFiles(token, driveSearchQuery);
      setDriveFiles(files);
      onAddLog(`📂 Search Drive returned ${files.length} related listings.`);
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Error searching Google Drive');
    } finally {
      setIsLoadingDrive(false);
    }
  };

  // Download and Parse file from Drive
  const handleLoadDriveFile = async (file: DriveFile) => {
    if (!token) return;
    onAddLog(`📥 Requesting binary stream for: ${file.name}`);
    toast(`Downloading document: ${file.name}...`);
    try {
      const content = await fetchDriveFileContent(token, file.id);
      onImportDriveContent(content, file.name);
      onAddLog(`✅ Successfully downloaded file "${file.name}" size: ${file.size || 'unknown'} bytes.`);
    } catch (err: any) {
      console.error(err);
      toast(`Failed to load file content: ${err.message}`);
    }
  };

  // Fetch Inbox Gmail Threads
  const handleFetchGmail = async () => {
    if (!token) return;
    setIsLoadingGmail(true);
    try {
      const threads = await fetchGmailThreads(token);
      setGmailThreads(threads);
      onAddLog(`📬 Syncing recent Gmail threads retrieved: ${threads.length}`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingGmail(false);
    }
  };

  // Auto load when connection establishes
  useEffect(() => {
    if (token) {
      handleSearchDrive();
      handleFetchGmail();
    }
  }, [token, triggerGmailListRef]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* COLUMN 1: OAUTH ACCOUNT MANAGER (COL 1 to 4) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* ACCOUNT CONTROL CARD */}
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider font-display">
              <Cloud className="text-emerald-400 w-4.5 h-4.5" />
              Workspace Integration
            </h3>
            
            <span className={`w-2.5 h-2.5 rounded-full ${token ? 'bg-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-700'}`}></span>
          </div>

          {!user ? (
            <div className="space-y-4 text-center py-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your real Google Drive and Gmail account with permission to query database CSV files, search for SQL attachments, and send compiled HTML analytics updates!
              </p>

              {/* SPECIFIC GSI STANDARD BUTTON STYLING */}
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-black px-6 py-3 rounded-xl transition shadow-xl w-full cursor-pointer border border-slate-200"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
                    Connecting Account...
                  </>
                ) : (
                  <>
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-emerald-500/30" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold font-mono">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="truncate text-xs leading-normal">
                  <strong className="text-slate-100 block truncate">{user.displayName || 'Authorized Client'}</strong>
                  <span className="text-slate-550 block truncate">{user.email}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-[10px] font-mono text-emerald-400 space-y-1">
                <div className="flex justify-between">
                  <span>Scope list verification:</span>
                  <strong className="text-emerald-300 font-bold">Active</strong>
                </div>
                <div className="truncate">✓ drive.readonly</div>
                <div className="truncate">✓ gmail.readonly</div>
                <div className="truncate">✓ gmail.send</div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                De-authorize Tokens
              </button>
            </div>
          )}
        </div>

        {/* LOG SYSTEM TERMINAL BOX */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 text-[10px] font-mono text-slate-500 space-y-2">
          <span className="text-xs font-bold text-slate-400 font-display block">Sync Logging Outputs</span>
          <p className="leading-relaxed">
            API connections and dynamic token rotations logs are trace-recorded here:
          </p>
          <div className="bg-slate-950 bg-opacity-70 p-2.5 rounded border border-slate-900 text-emerald-405 leading-relaxed truncate">
            &gt; OAuth2 initialized. Callback ready.
          </div>
        </div>

      </div>

      {/* COLUMN 2: DRIVE EXPLORER (COL 5 to 8) */}
      <div className="lg:col-span-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 flex flex-col justify-between">
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider font-display">
              <FolderOpen className="text-emerald-500 w-4.5 h-4.5" />
              Drive Schema Browser
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">FILES</span>
          </div>

          <p className="text-xs text-slate-400 mt-0.5 leading-normal">
            Browse text schemas, sql snippets, or spreadsheets definitions in Google Drive and parse instantly using standard structures.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-550" />
              <input 
                type="text" 
                placeholder="Search drive documents..."
                value={driveSearchQuery}
                onChange={(e) => setDriveSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchDrive(); }}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-slate-300"
              />
            </div>
            <button
              onClick={handleSearchDrive}
              disabled={!token}
              className="px-3.5 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black hover:bg-emerald-400 transition cursor-pointer disabled:opacity-40"
            >
              Go
            </button>
          </div>

          {!token ? (
            <div className="h-48 bg-slate-950/40 rounded-xl border border-dashed border-slate-850 flex flex-col items-center justify-center text-center p-4">
              <Lock className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-slate-550 text-[10px] leading-relaxed select-none">Drive blocked. Unlock by establishing workspace authorization on account panel.</p>
            </div>
          ) : isLoadingDrive ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400 gap-1.5">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
              Indexing cloud records...
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-center p-4 bg-slate-950/20 border border-slate-850/50 rounded-xl text-[10px] text-slate-500 leading-normal">
              No applicable documents (SQL scripts, schema files, CSV structure outlines) matched query search filters.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {driveFiles.map((file) => (
                <div 
                  key={file.id}
                  onClick={() => handleLoadDriveFile(file)}
                  className="group p-2.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 hover:border-emerald-500/20 rounded-xl transition cursor-pointer flex items-center justify-between text-xs font-mono"
                  title="Click to import and trigger AI schema parsers"
                >
                  <div className="truncate max-w-[170px]">
                    <span className="text-slate-200 block truncate group-hover:text-emerald-400 font-sans font-medium text-[11px]">{file.name}</span>
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5">{file.mimeType.split('/').pop() || 'file'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition" />
                </div>
              ))}
            </div>
          )}
        </div>

        {token && driveFiles.length > 0 && (
          <div className="bg-slate-950 border border-slate-850/50 p-2.5 rounded-xl text-[9px] font-mono text-slate-500 leading-normal mt-4">
            💡 Pro-Tip: Select standard code scripts to instantly run dynamic AI tables assemblies.
          </div>
        )}

      </div>

      {/* COLUMN 3: GMAIL COMMUNICATOR INBOX FEED (COL 9 to 12) */}
      <div className="lg:col-span-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-850/50 flex flex-col justify-between">
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider font-display">
              <Inbox className="text-emerald-500 w-4.5 h-4.5" />
              Inbox attachment scan (Gmail)
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">FEED</span>
          </div>

          <p className="text-xs text-slate-400 mt-0.5 leading-normal">
            Lists recent communication emails detailing schemas references models or query structures in folders.
          </p>

          {!token ? (
            <div className="h-48 bg-slate-950/40 rounded-xl border border-dashed border-slate-850 flex flex-col items-center justify-center text-center p-4 mt-6">
              <Lock className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-slate-550 text-[10px] leading-relaxed select-none">Gmail logs blocked. Sync Google workspace account first.</p>
            </div>
          ) : isLoadingGmail ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400 gap-1.5">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
              Syncing Gmail records...
            </div>
          ) : gmailThreads.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-center p-4 bg-slate-950/20 border border-slate-850/50 rounded-xl text-[10px] text-slate-500 leading-normal mt-4 animate-in fade-in">
              No recent emails matching terms "sql", "query", or "database" found. Try sending one to see listings!
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {gmailThreads.map((thread) => (
                <div 
                  key={thread.id}
                  onClick={() => {
                    if (thread.snippet) {
                      onImportDriveContent(thread.snippet, `Gmail_Snippet_${thread.id}.txt`);
                      onAddLog(`Imported snippet content from email: "${thread.subject}"`);
                    }
                  }}
                  className="group p-2.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-850 hover:border-emerald-500/20 rounded-xl transition cursor-pointer text-xs font-mono text-left"
                  title="Click to import e-mail snippet body into coding board"
                >
                  <div className="truncate">
                    <strong className="text-slate-200 block truncate group-hover:text-emerald-400 font-sans font-semibold text-[11px] leading-normal">{thread.subject}</strong>
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5">From: {thread.from.split(' <')[0]}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-1 leading-normal block">"{thread.snippet}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {token && (
          <button
            type="button"
            onClick={handleFetchGmail}
            className="w-full mt-4 py-2 bg-slate-955 hover:bg-slate-900 text-[11px] font-semibold text-slate-300 rounded border border-slate-850 flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Inbox Feeds
          </button>
        )}

      </div>

    </div>
  );
}
