import React, { useState } from 'react';
import { useChart } from '../context/ChartContext';
import { Lock, ShieldCheck, ShieldAlert, X, PlusCircle, Trash2, Table, Save, FileText, Download, Upload, LogOut, CheckCircle, RefreshCw, Key } from 'lucide-react';

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

  if (!showAdminModal) return null;

  const handleLoginSubmit = (e) => {
    e?.preventDefault();
    const res = loginAdmin(passcode);
    if (res.success) {
      setLoginError('');
      setPasscode('');
    } else {
      setLoginError(res.message);
    }
  };

  const handleQuickFillCode = () => {
    setPasscode('mas9090');
    setLoginError('');
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
        setAdminMsg(`✅ Created and published chart "${cleanName}" with imported data for all users!`);
        setChartName('');
        setRawText('');
        setTimeout(() => {
          setShowAdminModal(false);
          setActiveTab('editor');
        }, 1200);
      } else {
        setAdminMsg('❌ Failed to extract Jodi pairs from raw text.');
      }
    } else {
      const r = Math.max(1, parseInt(rows) || 20);
      const c = Math.min(8, Math.max(5, parseInt(cols) || 7));
      const emptyGrid = Array.from({ length: r }, () => Array.from({ length: c }, () => ({ val: '' })));
      saveChart(cleanName, r, c, emptyGrid);
      setAdminMsg(`✅ Created and published blank chart "${cleanName}" (${r}x${c}) for all users!`);
      setChartName('');
      setTimeout(() => {
        setShowAdminModal(false);
        setActiveTab('editor');
      }, 1200);
    }
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

  const handleImportBackupFile = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && typeof parsed === 'object') {
            Object.keys(parsed).forEach(key => {
              const item = parsed[key];
              if (item && item.data) {
                saveChart(key, item.rows || item.data.length, item.cols || (item.data[0] ? item.data[0].length : 7), item.data);
              }
            });
            setAdminMsg(`✅ Successfully imported ${Object.keys(parsed).length} charts from JSON!`);
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
                {isAdminLoggedIn ? 'Logged in as Admin (Code: mas9090)' : 'Enter Passcode mas9090 to unlock Admin features'}
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
                  Users do not need to log in to use the app. Enter passcode <span className="text-amber-400 font-mono font-bold">mas9090</span> to create & manage charts.
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
                    placeholder="Enter Code (e.g. mas9090)"
                    autoFocus
                    className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-500 text-amber-300 font-mono font-black rounded-xl px-4 py-3 text-sm outline-none shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleQuickFillCode}
                    className="absolute right-2 top-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition"
                  >
                    Quick Code: mas9090
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl text-sm shadow-xl active:scale-95 transition flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Verify Code & Login Admin
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
                  <span className="text-slate-400 font-mono text-xs">
                    Code: <strong className="text-emerald-400">mas9090</strong>
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
                <form onSubmit={handleCreateChart} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4" /> Admin: Create & Publish New Market Chart
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
                        min={5}
                        max={200}
                        value={rows}
                        onChange={(e) => setRows(e.target.value)}
                        className="w-16 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs"
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
                    <Save className="w-4 h-4" /> Publish Chart (Users Can Modify Grid)
                  </button>
                </form>
              )}

              {/* TAB 2: MANAGE STORE CHARTS */}
              {activeAdminTab === 'manage' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-950 p-2.5 border border-slate-800 rounded-xl text-xs font-bold text-slate-300">
                    <span>Total Market Charts: {chartKeys.length}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={resetToDefaultCharts}
                        className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                      >
                        <RefreshCw className="w-3 h-3" /> Load Presets
                      </button>
                      <button
                        onClick={clearAllCharts}
                        className="flex items-center gap-1 text-[11px] text-red-400 hover:underline"
                      >
                        <Trash2 className="w-3 h-3" /> Clear All
                      </button>
                    </div>
                  </div>

                  {chartKeys.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">No charts stored yet. Create one above!</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                      {chartKeys.map((name) => {
                        const chart = charts[name];
                        const rCount = chart?.rows || (chart?.data ? chart.data.length : 20);
                        const cCount = chart?.cols || 7;
                        return (
                          <div key={name} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 shadow">
                            <div>
                              <div className="font-black text-amber-400 text-xs uppercase">{name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{rCount} Rows × {cCount} Cols</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setActiveChartName(name);
                                  setShowAdminModal(false);
                                  setActiveTab('editor');
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-blue-300 text-[10px] font-bold px-2 py-1 rounded-lg"
                              >
                                Edit Grid
                              </button>
                              <button
                                onClick={() => deleteChart(name)}
                                className="bg-red-950 text-red-400 hover:bg-red-900 text-[10px] font-bold p-1 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
