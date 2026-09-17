import React, { useState } from 'react';
import { useChart } from '../context/ChartContext';
import { Lock, ShieldCheck, ShieldAlert, X, PlusCircle, Trash2, Table, Save, FileText, Download, Upload, LogOut, CheckCircle, RefreshCw, Key, Copy, Edit3, Plus, Share2 } from 'lucide-react';

export const AdminModal = () => {
  const {
    showAdminModal,
    setShowAdminModal,
    isAdminLoggedIn,
    loginAdmin,
    logoutAdmin,
    charts = {},
    saveChart,
    deleteChart,
    resetToDefaultCharts,
    clearAllCharts,
    setActiveChartName,
    setActiveTab,
    importRawData
  } = useChart();

  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState('create'); // 'create', 'manage', 'backup'

  // Create Chart Form State
  const [chartName, setChartName] = useState('');
  const [rows, setRows] = useState(25);
  const [cols, setCols] = useState(7);
  const [rawText, setRawText] = useState('');
  const [isImportMode, setIsImportMode] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');

  // Editing / Renaming Modal State
  const [editingChartName, setEditingChartName] = useState(null);
  const [newChartNameInput, setNewChartNameInput] = useState('');

  if (!showAdminModal) return null;

  const handleLoginSubmit = (e) => {
    e?.preventDefault();
    const res = loginAdmin(passcode);
    if (res.success) {
      setLoginError('');
      setPasscode('');
    } else {
      setLoginError('Invalid Admin Passcode!');
    }
  };

  const handleCreateChart = (e) => {
    e?.preventDefault();
    const cleanName = chartName.trim().toUpperCase();
    if (!cleanName) {
      setAdminMsg('⚠️ Please enter a valid Chart Name!');
      return;
    }

    if (isImportMode && rawText.trim()) {
      const success = importRawData(cleanName, rawText, cols, rows);
      if (success) {
        setActiveChartName(cleanName);
        setAdminMsg(`✅ Created and published chart "${cleanName}"! Opening Grid...`);
        setChartName('');
        setRawText('');
        setTimeout(() => {
          setShowAdminModal(false);
          setActiveTab('editor');
        }, 800);
      } else {
        setAdminMsg('❌ Failed to extract Jodi pairs from raw text.');
      }
    } else {
      const r = Math.max(1, parseInt(rows) || 20);
      const c = Math.min(8, Math.max(5, parseInt(cols) || 7));
      const emptyGrid = Array.from({ length: r }, () => Array.from({ length: c }, () => ({ val: '' })));
      saveChart(cleanName, r, c, emptyGrid);
      setActiveChartName(cleanName);
      setAdminMsg(`✅ Created and published chart "${cleanName}" (${r}x${c})! Opening Grid...`);
      setChartName('');
      setTimeout(() => {
        setShowAdminModal(false);
        setActiveTab('editor');
      }, 800);
    }
  };

  const handleAppendRows = (name, count) => {
    const chart = charts[name];
    if (!chart || !chart.data) return;
    const c = chart.cols || (chart.data[0] ? chart.data[0].length : 7);
    const extraGrid = Array.from({ length: count }, () => Array.from({ length: c }, () => ({ val: '' })));
    const newGrid = [...chart.data, ...extraGrid];
    saveChart(name, newGrid.length, c, newGrid);
    setAdminMsg(`✅ Appended +${count} empty rows to "${name}" (Total: ${newGrid.length} Rows)`);
  };

  const handleCloneChart = (name) => {
    const chart = charts[name];
    if (!chart || !chart.data) return;
    const cloneName = `${name}_COPY`;
    const c = chart.cols || (chart.data[0] ? chart.data[0].length : 7);
    saveChart(cloneName, chart.data.length, c, chart.data);
    setActiveChartName(cloneName);
    setAdminMsg(`✅ Cloned "${name}" to "${cloneName}"!`);
  };

  const handleRenameSubmit = (oldName) => {
    const cleanNew = newChartNameInput.trim().toUpperCase();
    if (!cleanNew || cleanNew === oldName) {
      setEditingChartName(null);
      return;
    }
    const chart = charts[oldName];
    if (!chart) return;
    saveChart(cleanNew, chart.rows || chart.data.length, chart.cols || 7, chart.data);
    deleteChart(oldName);
    setActiveChartName(cleanNew);
    setEditingChartName(null);
    setNewChartNameInput('');
    setAdminMsg(`✅ Renamed chart from "${oldName}" to "${cleanNew}"`);
  };

  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(charts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `matka_charts_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyShareLink = () => {
    try {
      const encoded = encodeURIComponent(JSON.stringify(charts));
      const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
      navigator.clipboard.writeText(shareUrl);
      setAdminMsg('📋 Copied 1-Click Mobile Share Link! Send/open this link on any mobile phone to sync all charts instantly.');
    } catch (err) {
      setAdminMsg('❌ Failed to copy share link.');
    }
  };

  const handleImportBackupFile = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && typeof parsed === 'object') {
            const keys = Object.keys(parsed);
            keys.forEach(key => {
              const item = parsed[key];
              if (item && item.data) {
                saveChart(key, item.rows || item.data.length, item.cols || (item.data[0] ? item.data[0].length : 7), item.data);
              }
            });
            if (keys.length > 0) setActiveChartName(keys[0]);
            setAdminMsg(`✅ Successfully imported ${keys.length} charts from JSON!`);
          }
        } catch (err) {
          setAdminMsg('❌ Invalid JSON file format.');
        }
      };
    }
  };

  const chartKeys = Object.keys(charts || {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/90 text-white">
          <div className="flex items-center gap-2.5">
            {isAdminLoggedIn ? (
              <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            ) : (
              <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide">
                {isAdminLoggedIn ? 'Admin Control Center' : 'Admin Login Required'}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {isAdminLoggedIn ? 'Logged in as Admin' : 'Enter Secret Admin Passcode'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAdminModal(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">

          {/* IF NOT LOGGED IN: LOGIN FORM */}
          {!isAdminLoggedIn ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-md mx-auto py-2">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400 mb-2 shadow-inner">
                  <Key className="w-7 h-7 animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-white">Access Admin Options</h3>
                <p className="text-xs text-slate-400">
                  Users do not need to log in to use the app. Enter secret passcode to create &amp; manage charts.
                </p>
              </div>

              {loginError && (
                <div className="bg-red-950/80 border border-red-600 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2 font-bold animate-shake">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                  Admin Passcode:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter Secret Passcode"
                    autoFocus
                    className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-500 text-amber-300 font-mono font-black rounded-xl px-4 py-3 text-sm outline-none shadow-inner"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl text-sm shadow-xl active:scale-95 transition flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Verify Code &amp; Login Admin
              </button>
            </form>
          ) : (

            /* IF LOGGED IN: ADMIN CONTROL PANEL */
            <div className="space-y-4">

              {/* Admin Mode Header Badge & Logout */}
              <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-950 border border-emerald-500/40 rounded-2xl p-3 shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500 text-slate-950 text-[11px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1">
                    👑 ADMIN ACTIVE
                  </span>
                </div>
                <button
                  onClick={logoutAdmin}
                  className="flex items-center gap-1 bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-300 text-xs font-bold px-3 py-1.5 rounded-xl transition active:scale-95 ml-auto"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout Admin
                </button>
              </div>

              {/* Status Message Notification */}
              {adminMsg && (
                <div className="bg-slate-950 border border-emerald-500/60 text-emerald-300 text-xs p-3 rounded-xl font-bold flex items-center justify-between gap-2 animate-fadeIn">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    {adminMsg}
                  </span>
                  <button onClick={() => setAdminMsg('')} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Admin Navigation Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveAdminTab('create')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    activeAdminTab === 'create'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" /> Create Chart
                </button>
                <button
                  onClick={() => setActiveAdminTab('manage')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    activeAdminTab === 'manage'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Table className="w-4 h-4" /> Manage ({chartKeys.length})
                </button>
                <button
                  onClick={() => setActiveAdminTab('backup')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    activeAdminTab === 'backup'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Download className="w-4 h-4" /> Backup JSON
                </button>
              </div>

              {/* TAB 1: CREATE CHART FOR USERS */}
              {activeAdminTab === 'create' && (
                <div className="space-y-3">
                  {/* Direct Launch Full Interactive Controls Panel Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      setActiveTab('editor');
                    }}
                    className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-slate-950 font-black py-3 px-4 rounded-xl text-xs shadow-xl active:scale-95 transition flex items-center justify-center gap-2 border border-amber-300"
                  >
                    <PlusCircle className="w-4 h-4 text-slate-950" />
                    <span>⚡ Open Full Grid Controls &amp; Editor Options</span>
                  </button>

                  <form onSubmit={handleCreateChart} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <PlusCircle className="w-4 h-4" /> Quick Publish New Market Chart
                      </h4>
                    <button
                      type="button"
                      onClick={() => setIsImportMode(!isImportMode)}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition ${
                        isImportMode ? 'bg-purple-900 border-purple-500 text-purple-200' : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {isImportMode ? '📋 Raw Paste Mode ON' : '✏️ Blank Grid Mode'}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">Chart Market Name:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. KALYAN NIGHT, SRIDEVI DAY, MAIN BAZAR"
                      value={chartName}
                      onChange={(e) => setChartName(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 text-amber-300 font-black rounded-xl px-3.5 py-2 text-xs outline-none focus:border-amber-400 uppercase tracking-wide"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400">Rows:</label>
                      <input
                        type="number"
                        min={1}
                        max={5000}
                        value={rows}
                        onChange={(e) => setRows(e.target.value)}
                        className="w-20 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400">Cols (Days):</label>
                      <input
                        type="number"
                        min={5}
                        max={8}
                        value={cols}
                        onChange={(e) => setCols(e.target.value)}
                        className="w-14 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {isImportMode && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Paste Raw Jodi Data Text:
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Paste raw jodi numbers (e.g. 53 84 07 12 69 ** 24 65 18 90...)"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs rounded-xl p-2.5 outline-none focus:border-purple-400"
                      />
                    </div>
                  )}

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white font-black py-2.5 rounded-xl text-xs shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-4 h-4" /> Quick Publish Chart
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: MANAGE STORE CHARTS & ADMIN TOOLS */}
              {activeAdminTab === 'manage' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-950 p-2.5 border border-slate-800 rounded-xl text-xs font-bold text-slate-300">
                    <span>Total Market Charts: {chartKeys.length}</span>
                    <button
                      onClick={clearAllCharts}
                      className="flex items-center gap-1 text-[11px] text-red-400 hover:underline"
                    >
                      <Trash2 className="w-3 h-3" /> Clear All Store
                    </button>
                  </div>

                  {chartKeys.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">No charts stored yet. Create one in the "Create Chart" tab above!</div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto p-1">
                      {chartKeys.map((name) => {
                        const chart = charts[name];
                        const rCount = chart?.rows || (chart?.data ? chart.data.length : 20);
                        const cCount = chart?.cols || 7;
                        const isEditingThis = editingChartName === name;

                        return (
                          <div key={name} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 shadow">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="text"
                                    value={newChartNameInput}
                                    onChange={(e) => setNewChartNameInput(e.target.value.toUpperCase())}
                                    className="bg-slate-900 border border-amber-500 text-amber-300 text-xs font-bold px-2 py-1 rounded"
                                  />
                                  <button
                                    onClick={() => handleRenameSubmit(name)}
                                    className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingChartName(null)}
                                    className="text-slate-400 text-[10px] px-1"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-black text-amber-400 text-xs uppercase flex items-center gap-1.5">
                                    <span>{name}</span>
                                    <button
                                      onClick={() => {
                                        setEditingChartName(name);
                                        setNewChartNameInput(name);
                                      }}
                                      className="text-slate-500 hover:text-amber-300"
                                      title="Rename Chart"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">{rCount} Rows × {cCount} Cols</div>
                                </div>
                              )}

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setActiveChartName(name);
                                    setShowAdminModal(false);
                                    setActiveTab('editor');
                                  }}
                                  className="bg-slate-800 hover:bg-slate-700 text-blue-300 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                                >
                                  Open Grid
                                </button>
                                <button
                                  onClick={() => handleCloneChart(name)}
                                  className="bg-slate-800 hover:bg-slate-700 text-purple-300 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                                  title="Clone Chart"
                                >
                                  <Copy className="w-3 h-3" /> Clone
                                </button>
                                <button
                                  onClick={() => deleteChart(name)}
                                  className="bg-red-950 text-red-400 hover:bg-red-900 text-[10px] font-bold p-1 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Quick Admin Actions: Append Rows */}
                            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-900 text-[10px]">
                              <span className="text-slate-400 font-bold shrink-0">Append Empty Rows:</span>
                              <button
                                onClick={() => handleAppendRows(name, 10)}
                                className="bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold"
                              >
                                +10 Rows
                              </button>
                              <button
                                onClick={() => handleAppendRows(name, 25)}
                                className="bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold"
                              >
                                +25 Rows
                              </button>
                              <button
                                onClick={() => handleAppendRows(name, 50)}
                                className="bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold"
                              >
                                +50 Rows
                              </button>
                              <button
                                onClick={() => handleAppendRows(name, 100)}
                                className="bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold"
                              >
                                +100 Rows
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BACKUP & RESTORE JSON */}
              {activeAdminTab === 'backup' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-1">Mobile &amp; Multi-Device Sync Link</h4>
                    <p className="text-[11px] text-slate-400 mb-2">Generate a 1-click share link to immediately sync all published charts on any mobile phone or browser.</p>
                    <button
                      onClick={handleCopyShareLink}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow active:scale-95 transition"
                    >
                      <Share2 className="w-4 h-4" /> 📋 Copy 1-Click Mobile Share Link
                    </button>
                  </div>

                  <hr className="border-slate-800" />

                  <div>
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-1">Export Chart Repository</h4>
                    <p className="text-[11px] text-slate-400 mb-2">Download all saved market charts as a JSON backup file.</p>
                    <button
                      onClick={handleExportBackup}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow active:scale-95 transition"
                    >
                      <Download className="w-4 h-4" /> Download JSON Backup File
                    </button>
                  </div>

                  <hr className="border-slate-800" />

                  <div>
                    <h4 className="text-xs font-black text-purple-400 uppercase tracking-wider mb-1">Import JSON Backup</h4>
                    <p className="text-[11px] text-slate-400 mb-2">Upload a previously saved JSON chart backup file to restore charts.</p>
                    <label className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 rounded-xl text-xs cursor-pointer shadow active:scale-95 transition">
                      <Upload className="w-4 h-4" /> Select Backup JSON File
                      <input type="file" accept=".json" onChange={handleImportBackupFile} className="hidden" />
                    </label>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
