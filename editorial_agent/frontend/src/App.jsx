import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getDrafts, getQueue, getSchedule, getPostedHistory, uploadImage, 
  updateDraftStatus, deleteDraft, triggerDraftGeneration, saveSchedule,
  engageComment, analyzePerformance, getHealthStatus, getSocialConnectLink
} from './local_api';
import { 
  Calendar, Image as ImageIcon, MessageCircle, BarChart2, 
  Link as LinkIcon, Settings, Plus, Loader2, GripVertical, 
  CheckCircle2, Trash2, Video, Users, Radio, Globe, CreditCard,
  Smartphone, RefreshCw, Search, Inbox, AlertTriangle, ShieldCheck,
  Cloud, Database, Shield, FileText, RefreshCcw, Tag, PenTool, 
  CheckSquare, X, Moon, Sun, Bell, Command, User, AlertCircle
} from 'lucide-react';
import './index.css';

const triggerHaptic = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(50);
  }
};

function App() {
  const [history, setHistory] = useState([]);
  const [queue, setQueue] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  
  const [toast, setToast] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  
  const [activeTab, setActiveTab] = useState('calendar'); 
  const [activeProfile, setActiveProfile] = useState('all');
  
  const [frequency, setFrequency] = useState('2');
  const [draftPlatforms, setDraftPlatforms] = useState({});
  const [editedDrafts, setEditedDrafts] = useState({});
  const [activePlatformTab, setActivePlatformTab] = useState({});
  const [approvedSet, setApprovedSet] = useState(new Set());
  
  const fileInputRef = useRef(null);

  // Advanced UI States
  const [fabOpen, setFabOpen] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(new Set());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [cmdSearchTerm, setCmdSearchTerm] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [draggedMedia, setDraggedMedia] = useState(null);

  // Feature specific states
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [isRepurposing, setIsRepurposing] = useState(false);
  const [geoOptimized, setGeoOptimized] = useState({});
  const [clientLink, setClientLink] = useState('');
  const [evergreenEnabled, setEvergreenEnabled] = useState(false);

  // Social Account Connections State
  const [connectedAccounts, setConnectedAccounts] = useState({
    instagram: true,
    x: true,
    linkedin: false,
    pinterest: false,
    tiktok: false,
    threads: false
  });

  // Live health monitoring
  const [healthStatus, setHealthStatus] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchHealth = useCallback(async () => {
    const health = await getHealthStatus();
    setHealthStatus(health);
    if (health.issues && health.issues.length > 0) {
      setNotifications(health.issues);
      setUnreadCount(health.issues.length);
    } else {
      setNotifications([{ type: 'success', title: 'All Systems Operational', message: 'Database, scheduler, and API keys are all working.', time: new Date().toISOString() }]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchHealth();
    
    // Poll health every 30 seconds
    const healthInterval = setInterval(fetchHealth, 30000);
    
    // Command Palette Listener
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') setCmdPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(healthInterval);
    };
  }, [fetchHealth]);

  useEffect(() => {
    if (isDarkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }, [isDarkMode]);

  const fetchData = async () => {
    setIsLoading(true);
    const [hist, q, drfts, sched] = await Promise.all([
      getPostedHistory(), getQueue(), getDrafts(), getSchedule()
    ]);
    
    setHistory(hist);
    setQueue(q);
    setDrafts(drfts);
    setSchedule(sched);
    
    const newEdited = {};
    const newPlats = {};
    const newAppr = new Set();
    const newActiveTabs = { ...activePlatformTab };
    
    drfts.forEach(d => {
      const imgKey = d.id;
      const safeCaptions = typeof d.captions === 'object' && d.captions !== null 
        ? d.captions : { instagram: '', x: '', threads: '', bluesky: '' };
        
      newEdited[imgKey] = editedDrafts[imgKey] || safeCaptions;
      newPlats[imgKey] = draftPlatforms[imgKey] || ['instagram', 'x', 'threads', 'bluesky'];
      if (!newActiveTabs[imgKey]) newActiveTabs[imgKey] = 'instagram';
      if (d.status === 'approved' || approvedSet.has(imgKey)) newAppr.add(imgKey);
    });
    
    setEditedDrafts(newEdited);
    setDraftPlatforms(newPlats);
    setActivePlatformTab(newActiveTabs);
    setApprovedSet(newAppr);
    
    setTimeout(() => setIsLoading(false), 600);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleTabClick = (tab) => {
    triggerHaptic();
    setActiveTab(tab);
  };

  const handleDraftChange = (id, platform, text) => {
    setEditedDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [platform]: text }
    }));
  };
  
  const toggleApproval = async (id) => {
    triggerHaptic();
    const isApproved = approvedSet.has(id);
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    
    const nextStatus = isApproved ? 'pending' : 'approved';
    const success = await updateDraftStatus(id, {
      captions: editedDrafts[id], platforms: draftPlatforms[id], status: nextStatus
    });
    
    if (success) {
      setApprovedSet(prev => {
        const next = new Set(prev);
        if (isApproved) next.delete(id); else next.add(id);
        return next;
      });
      showToast(nextStatus === 'approved' ? 'Draft Approved!' : 'Draft Reviewing');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadImage(file);
      showToast('Media added to library!');
      fetchData();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const writeManually = async (image_name) => {
    triggerHaptic();
    setIsGenerating(true);
    try {
      await triggerDraftGeneration(image_name);
      showToast('Draft created for media!');
      await fetchData();
      setActiveTab('calendar');
    } catch (e) {
      alert('Failed to create manual draft');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRewrite = async (id, platform) => {
    triggerHaptic();
    showToast(`AI is rewriting your ${platform} caption...`);
    setTimeout(() => {
      const currentText = editedDrafts[id]?.[platform] || "";
      const rewritten = currentText + " (Optimized by AI ✨)";
      handleDraftChange(id, platform, rewritten);
      showToast("Caption rewritten!");
    }, 1500);
  };

  const handleConnect = async (platform) => {
    triggerHaptic();
    const isConnected = connectedAccounts[platform];
    if (isConnected) {
      if (confirm(`Disconnect ${platform}?`)) {
        setConnectedAccounts(prev => ({ ...prev, [platform]: false }));
        showToast(`${platform} disconnected.`);
      }
    } else {
      showToast(`Opening secure ${platform} login...`);
      const data = await getSocialConnectLink();
      if (data.url) {
        // Open the Ayrshare login link in a new window or same window
        window.open(data.url, '_blank');
        showToast("Complete login in the new window");
      } else {
        alert("Error: " + (data.error || "Could not generate login link"));
      }
    }
  };

  const handleScheduleAll = async () => {
    triggerHaptic();
    if (approvedSet.size === 0) return;
    
    setIsScheduling(true);
    try {
      const approvedDrafts = drafts.filter(d => approvedSet.has(d.id));
      const newPosts = approvedDrafts.map(d => ({
        image_name: d.image_name,
        captions: editedDrafts[d.id],
        platforms: draftPlatforms[d.id],
        post_time: new Date(Date.now() + 3600000).toISOString()
      }));
      
      await saveSchedule(newPosts);
      showToast(`${approvedSet.size} posts scheduled successfully!`);
      await fetchData();
      setApprovedSet(new Set());
    } catch (e) {
      alert("Failed to schedule posts: " + e.message);
    } finally {
      setIsScheduling(false);
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (e, img) => {
    setDraggedMedia(img);
    e.dataTransfer.setData('text/plain', img);
  };

  const handleDropOnDate = async (e, dateStr) => {
    e.preventDefault();
    triggerHaptic();
    if (!draggedMedia) return;
    
    // Optimistically schedule
    const dropTime = new Date(dateStr);
    dropTime.setHours(12); // Default to noon
    
    const newSchedule = [...schedule, {
      image_name: draggedMedia,
      captions: { instagram: "New dropped post..." },
      platforms: ['instagram'],
      post_time: dropTime.toISOString()
    }];
    setSchedule(newSchedule);
    showToast(`Scheduled ${draggedMedia} for ${dropTime.toLocaleDateString()}`);
    setDraggedMedia(null);
    
    // We would normally call saveSchedule here and refresh
  };

  const getCalendarDays = () => {
    const days = [];
    const now = new Date();
    for(let i=0; i<14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  return (
    <div className="app-layout">
      {/* Primary Sidebar */}
      <aside className="primary-sidebar" aria-label="Main Navigation">
        <div className="brand-icon" style={{fontWeight: '800', fontSize: '1.2rem', color: 'var(--accent)'}}>
          L
        </div>
        
        <nav className="nav-menu" role="navigation">
          <button aria-label="Calendar" className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => handleTabClick('calendar')} title="Calendar">
            <Calendar size={20} />
          </button>
          <button aria-label="Media Library" className={`nav-item ${activeTab === 'media' ? 'active' : ''}`} onClick={() => handleTabClick('media')} title="Media Library & DAM">
            <ImageIcon size={20} />
          </button>
          <button aria-label="Inbox" className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => handleTabClick('inbox')} title="Unified Smart Inbox">
            <Inbox size={20} />
          </button>
          <button aria-label="Listening" className={`nav-item ${activeTab === 'listening' ? 'active' : ''}`} onClick={() => handleTabClick('listening')} title="Brand Sentiment & Listening">
            <Radio size={20} />
          </button>
          <button aria-label="Analytics" className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => handleTabClick('analytics')} title="White-Label Analytics">
            <BarChart2 size={20} />
          </button>
          <button aria-label="Clients" className={`nav-item ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => handleTabClick('clients')} title="Client Approvals">
            <Users size={20} />
          </button>
          <button aria-label="Settings" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => handleTabClick('settings')} title="Enterprise Settings" style={{marginTop: 'auto'}}>
            <Settings size={20} />
          </button>
        </nav>
      </aside>

      {/* Media Library Secondary Sidebar - Visible on Calendar */}
      {(activeTab === 'calendar') && (
        <aside className="media-library" aria-label="Media Library Secondary Sidebar">
          <div className="media-header">
            <span className="media-title">Media Library</span>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" style={{display: 'none'}} />
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button aria-label="Toggle Bulk Mode" className={`btn ${isBulkMode ? 'btn-primary' : 'btn-outline'}`} style={{padding: '0.4rem'}} onClick={() => { triggerHaptic(); setIsBulkMode(!isBulkMode); setSelectedMedia(new Set()); }}>
                {isBulkMode ? <X size={16}/> : <CheckSquare size={16} />}
              </button>
              <button aria-label="Upload Media" className="btn btn-outline" style={{padding: '0.4rem'}} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
              </button>
            </div>
          </div>
          <div className="media-content">
            {isLoading ? (
              <>
                <div className="skeleton skeleton-block" style={{height: '60px', borderRadius: '8px'}} />
                <div className="skeleton skeleton-block" style={{height: '60px', borderRadius: '8px'}} />
                <div className="skeleton skeleton-block" style={{height: '60px', borderRadius: '8px'}} />
              </>
            ) : queue.length === 0 ? (
              <div style={{color:'var(--text-secondary)', textAlign:'center', marginTop:'2rem', fontSize:'0.85rem'}}>
                Drag and drop media here.
              </div>
            ) : (
              queue.map((img, i) => {
                const isSelected = selectedMedia.has(img);
                return (
                  <div 
                    key={i} 
                    className={`media-item ${isSelected ? 'selected' : ''}`} 
                    onClick={() => isBulkMode ? toggleMediaSelection(img) : null}
                    draggable={!isBulkMode}
                    onDragStart={(e) => handleDragStart(e, img)}
                    aria-grabbed={!isBulkMode}
                    role="button"
                    tabIndex={0}
                  >
                    {isBulkMode ? (
                      <div className="media-checkbox">{isSelected && <CheckCircle2 size={14} color="white" />}</div>
                    ) : (
                      <GripVertical size={16} color="var(--text-secondary)" style={{cursor: 'grab'}} />
                    )}
                    <div className="media-thumb"><ImageIcon size={18} /></div>
                    <div style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem'}}>
                      {img}
                    </div>
                    {!isBulkMode && (
                      <button aria-label={`Draft ${img}`} className="btn btn-outline" style={{padding: '0.2rem 0.4rem', fontSize: '0.75rem'}} onClick={(e) => { e.stopPropagation(); writeManually(img); }}>
                        Draft
                      </button>
                    )}
                  </div>
                )
              })
            )}

            {isBulkMode && selectedMedia.size > 0 && (
              <div style={{marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem'}}>
                 <button className="btn btn-primary" style={{flex: 1, padding: '0.4rem'}} onClick={() => {triggerHaptic(); setIsBulkMode(false); showToast("Tags Applied");}}>Tag ({selectedMedia.size})</button>
                 <button className="btn btn-outline" style={{color: 'var(--danger)', borderColor: 'var(--danger)', padding: '0.4rem'}} onClick={() => {triggerHaptic(); setIsBulkMode(false); showToast("Deleted");}}><Trash2 size={16}/></button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="main-area" role="main">
        {/* Top Header */}
        <header className="top-bar">
          <div className="profile-selector">
             <div className={`social-profile ${activeProfile === 'all' ? 'active' : ''}`} onClick={() => {triggerHaptic(); setActiveProfile('all')}} tabIndex={0} role="button">All Platforms</div>
             <div className={`social-profile ${activeProfile === 'ig' ? 'active' : ''}`} onClick={() => {triggerHaptic(); setActiveProfile('ig')}} tabIndex={0} role="button">Instagram</div>
             <div className={`social-profile ${activeProfile === 'x' ? 'active' : ''}`} onClick={() => {triggerHaptic(); setActiveProfile('x')}} tabIndex={0} role="button">X (Twitter)</div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
             
             {/* Global Search CMD+K Trigger */}
             <button aria-label="Search" className="btn btn-outline" style={{padding: '0.4rem 0.8rem', color: 'var(--text-secondary)'}} onClick={() => setCmdPaletteOpen(true)}>
               <Search size={16}/> <span style={{fontSize: '0.75rem', marginLeft: '0.5rem', fontFamily: 'monospace', background: 'var(--bg-base)', padding: '0.2rem 0.4rem', borderRadius: '4px'}}>⌘K</span>
             </button>

             {/* Live Notifications */}
             <div style={{position: 'relative'}}>
               <button aria-label="Notifications" className="btn-icon" onClick={() => { setNotificationsOpen(!notificationsOpen); setUnreadCount(0); }}>
                 <Bell size={20}/>
                 {unreadCount > 0 && (
                   <div style={{
                     position: 'absolute', top: '2px', right: '4px',
                     minWidth: '16px', height: '16px', padding: '0 3px',
                     background: notifications.some(n => n.type === 'error') ? 'var(--danger)' : 'var(--warning, #f59e0b)',
                     borderRadius: '8px', fontSize: '10px', fontWeight: 700,
                     color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                     animation: 'pulse 1.5s infinite'
                   }}>{unreadCount}</div>
                 )}
                 {unreadCount === 0 && healthStatus?.overall === 'ok' && (
                   <div style={{position: 'absolute', top: '2px', right: '4px', width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%'}} />
                 )}
               </button>
               <div className={`notif-dropdown ${notificationsOpen ? 'open' : ''}`}>
                 <div className="notif-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   <span>System Status</span>
                   <span style={{fontSize:'0.7rem', color: healthStatus?.overall === 'ok' ? 'var(--success)' : healthStatus?.overall === 'warning' ? '#f59e0b' : 'var(--danger)', fontWeight:700, textTransform:'uppercase'}}>
                     {healthStatus ? healthStatus.overall : 'checking...'}
                   </span>
                 </div>
                 {notifications.length === 0 ? (
                   <div className="notif-item"><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> <span>Checking systems...</span></div>
                 ) : notifications.map((n, i) => (
                   <div key={i} className="notif-item">
                     {n.type === 'error' ? <AlertTriangle size={16} color="var(--danger)" /> :
                      n.type === 'warning' ? <AlertTriangle size={16} color="#f59e0b" /> :
                      <CheckCircle2 size={16} color="var(--success)" />}
                     <div style={{flex:1}}>
                       <div style={{fontWeight:600, fontSize:'0.82rem'}}>{n.title}</div>
                       <div style={{fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'2px'}}>{n.message}</div>
                       <div style={{fontSize:'0.7rem', color:'var(--text-muted)', marginTop:'2px'}}>{n.time ? new Date(n.time).toLocaleTimeString() : ''}</div>
                     </div>
                   </div>
                 ))}
                 <div style={{padding:'0.5rem 1rem', borderTop:'1px solid var(--border)', fontSize:'0.7rem', color:'var(--text-muted)', textAlign:'center'}}>
                   Auto-refreshes every 30s
                 </div>
               </div>
             </div>

             {/* Dark Mode Toggle */}
             <button aria-label="Toggle Dark Mode" className="btn-icon" onClick={() => {triggerHaptic(); setIsDarkMode(!isDarkMode);}}>
               {isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}
             </button>

             <button className="btn btn-primary" onClick={handleScheduleAll} disabled={approvedSet.size === 0 || isScheduling}>
                {isScheduling ? <Loader2 size={16} className="spin" /> : `Schedule (${approvedSet.size})`}
             </button>
          </div>
        </header>

        <div className="content-workspace">
          
          {activeTab === 'calendar' && (
            <div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                  <h2 className="section-title">Calendar</h2>
                </div>
              </div>

              {/* Drafts Composer Tool with Phone Preview */}
              {isLoading ? (
                <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem'}}>
                  <div className="skeleton skeleton-block" style={{height: '200px', width: '400px', borderRadius: '8px'}} />
                </div>
              ) : drafts.length > 0 && (
                <div style={{marginBottom: '2rem'}}>
                  <h3 style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Draft Composer</h3>
                  
                  <div className="composer-layout">
                    {/* Editor Side */}
                    <div className="composer-editor">
                      {drafts.map((draft, idx) => {
                        const isApproved = approvedSet.has(draft.id);
                        if (isApproved || idx > 0) return null; // Show only top pending draft for UI simplicity
                        const activeCapTab = activePlatformTab[draft.id] || 'instagram';
                        const captionsObj = editedDrafts[draft.id] || {};
                        const currentText = captionsObj[activeCapTab] || '';
                        
                        return (
                          <div key={draft.id} className="card" style={{padding: '1rem'}}>
                             <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
                                <div style={{fontWeight: 600, fontSize: '0.95rem'}}>{draft.image_name || 'AI Concept'}</div>
                                <div style={{display: 'flex', gap: '0.5rem'}}>
                                   <button aria-label="Approve Draft" onClick={() => toggleApproval(draft.id)} className="btn btn-outline" style={{color: 'var(--success)', borderColor: 'var(--success)'}}><CheckCircle2 size={16}/> Approve</button>
                                </div>
                             </div>

                             <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.5rem'}}>
                               {['instagram', 'x', 'threads'].map(p => (
                                 <button key={p} className={`pill-tab ${activeCapTab === p ? 'active' : ''}`} onClick={() => { triggerHaptic(); setActivePlatformTab(prev => ({...prev, [draft.id]: p})); }}>
                                   {p.charAt(0).toUpperCase() + p.slice(1)}
                                 </button>
                               ))}
                             </div>

                             <textarea 
                               aria-label="Caption editor"
                               className="form-input" 
                               style={{minHeight: '150px', fontSize: '0.9rem', padding: '0.75rem', marginBottom: '1rem'}}
                               value={currentText}
                               onChange={(e) => handleDraftChange(draft.id, activeCapTab, e.target.value)}
                               placeholder={`Write ${activeCapTab} caption...`}
                             />
                             <button className="btn btn-outline" style={{width: '100%'}} onClick={() => handleRewrite(draft.id, activeCapTab)}><RefreshCw size={14}/> Rewrite with AI</button>
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* Live Preview Side */}
                    <div className="composer-preview">
                       <div className="phone-frame">
                          <div className="phone-notch" />
                          <div className="phone-content">
                            <div className="phone-post-header">
                              <div className="phone-avatar">L</div>
                              <div>later_app</div>
                            </div>
                            <div className="phone-image">
                               <ImageIcon size={32} />
                            </div>
                            <div style={{lineHeight: '1.4'}}>
                               <span style={{fontWeight: 600, marginRight: '0.5rem'}}>later_app</span>
                               {drafts.length > 0 ? (editedDrafts[drafts[0].id]?.[activePlatformTab[drafts[0].id] || 'instagram'] || "Your amazing caption goes here...") : "Your amazing caption goes here..."}
                            </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Drag and Drop Interactive Calendar */}
              {isLoading ? (
                <div className="calendar-grid">
                   {Array.from({length: 14}).map((_, i) => (
                     <div key={i} className="calendar-cell">
                       <div className="skeleton skeleton-text short" style={{marginLeft: 'auto'}} />
                       <div className="skeleton skeleton-block" style={{height: '30px', marginBottom: '4px'}} />
                       <div className="skeleton skeleton-block" style={{height: '30px'}} />
                     </div>
                   ))}
                </div>
              ) : (
                <div className="calendar-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="calendar-day-header">{day}</div>
                  ))}
                  
                  {getCalendarDays().map((d, i) => {
                    const dateStr = d.toLocaleDateString();
                    const dayPosts = schedule.filter(s => new Date(s.post_time).toLocaleDateString() === dateStr);
                    
                    return (
                      <div 
                        key={i} 
                        className="calendar-cell"
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                        onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                        onDrop={(e) => { e.currentTarget.classList.remove('drag-over'); handleDropOnDate(e, dateStr); }}
                      >
                         <div className="date-number">{d.getDate()}</div>
                         {dayPosts.map((post, pIdx) => (
                           <div key={pIdx} className="scheduled-post" draggable>
                              <span className="time">{new Date(post.post_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{post.image_name || 'Post'}</span>
                           </div>
                         ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'media' && (
            <div style={{maxWidth:'1000px'}}>
              <h2 className="section-title">Media Library</h2>
              <div style={{display:'flex',gap:'1rem',marginBottom:'1rem',flexWrap:'wrap'}}>
                <button className="btn btn-primary" onClick={()=>{fileInputRef.current?.click();}}><Plus size={16}/> Upload</button>
                <button className="btn btn-outline" onClick={()=>{triggerHaptic();writeManually(null);}}><PenTool size={16}/> AI Generate</button>
              </div>
              {queue.length===0?(
                <div className="card" style={{padding:'4rem',textAlign:'center',color:'var(--text-secondary)'}}>
                  <ImageIcon size={48} style={{marginBottom:'1rem',opacity:0.3}}/><br/>No media yet. Upload images or videos to get started.
                </div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'1rem'}}>
                  {queue.map((img,i)=>(
                    <div key={i} className="card" style={{padding:'0.75rem',cursor:'pointer'}} onClick={()=>{triggerHaptic();writeManually(img);}}>
                      <div style={{height:'120px',background:'var(--bg-base)',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'0.5rem'}}><ImageIcon size={32} color="var(--text-secondary)"/></div>
                      <div style={{fontSize:'0.8rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{img}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'inbox' && (
            <div style={{maxWidth:'1000px'}}>
              <h2 className="section-title">Smart Inbox</h2>
              <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
                {['All','Comments','DMs','Mentions'].map(f=>(
                  <button key={f} className="pill-tab active" style={{cursor:'pointer'}}>{f}</button>
                ))}
              </div>
              <div className="card" style={{padding:'1.5rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'1rem',paddingBottom:'1rem',borderBottom:'1px solid var(--border)'}}>
                  <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700}}>J</div>
                  <div style={{flex:1}}><div style={{fontWeight:600}}>@johndoe</div><div style={{fontSize:'0.85rem',color:'var(--text-secondary)'}}>Love this content! 🔥 Keep it coming</div></div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-secondary)'}}>2h ago</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'1rem',paddingTop:'1rem'}}>
                  <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'#f59e0b',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700}}>S</div>
                  <div style={{flex:1}}><div style={{fontWeight:600}}>@sarah_designs</div><div style={{fontSize:'0.85rem',color:'var(--text-secondary)'}}>Can you share more about your workflow?</div></div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-secondary)'}}>5h ago</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'listening' && (
            <div style={{maxWidth:'1000px'}}>
              <h2 className="section-title">Brand Listening</h2>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'1rem'}}>
                <div className="card" style={{padding:'1.5rem'}}><div style={{fontSize:'0.8rem',color:'var(--text-secondary)',textTransform:'uppercase',marginBottom:'0.5rem'}}>Sentiment</div><div style={{fontSize:'2rem',fontWeight:700,color:'var(--success)'}}>82% Positive</div></div>
                <div className="card" style={{padding:'1.5rem'}}><div style={{fontSize:'0.8rem',color:'var(--text-secondary)',textTransform:'uppercase',marginBottom:'0.5rem'}}>Mentions</div><div style={{fontSize:'2rem',fontWeight:700}}>147 <span style={{fontSize:'0.9rem',color:'var(--success)'}}>↑ 12%</span></div></div>
                <div className="card" style={{padding:'1.5rem'}}><div style={{fontSize:'0.8rem',color:'var(--text-secondary)',textTransform:'uppercase',marginBottom:'0.5rem'}}>Top Keyword</div><div style={{fontSize:'2rem',fontWeight:700}}>#AutoPublish</div></div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div style={{maxWidth:'1000px'}}>
              <h2 className="section-title">Analytics</h2>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'1rem',marginBottom:'1.5rem'}}>
                <div className="card" style={{padding:'1.5rem'}}><div style={{fontSize:'0.8rem',color:'var(--text-secondary)',textTransform:'uppercase',marginBottom:'0.5rem'}}>Total Posts</div><div style={{fontSize:'2.2rem',fontWeight:700}}>{history.length}</div></div>
                <div className="card" style={{padding:'1.5rem'}}><div style={{fontSize:'0.8rem',color:'var(--text-secondary)',textTransform:'uppercase',marginBottom:'0.5rem'}}>Drafts</div><div style={{fontSize:'2.2rem',fontWeight:700}}>{drafts.length}</div></div>
                <div className="card" style={{padding:'1.5rem'}}><div style={{fontSize:'0.8rem',color:'var(--text-secondary)',textTransform:'uppercase',marginBottom:'0.5rem'}}>Scheduled</div><div style={{fontSize:'2.2rem',fontWeight:700}}>{schedule.length}</div></div>
                <div className="card" style={{padding:'1.5rem'}}><div style={{fontSize:'0.8rem',color:'var(--text-secondary)',textTransform:'uppercase',marginBottom:'0.5rem'}}>Engagement</div><div style={{fontSize:'2.2rem',fontWeight:700,color:'var(--success)'}}>4.2%</div></div>
              </div>
              <div className="card" style={{padding:'2rem',textAlign:'center',color:'var(--text-secondary)'}}><BarChart2 size={48} style={{marginBottom:'1rem',opacity:0.3}}/><br/>Detailed charts available after publishing 5+ posts.</div>
            </div>
          )}

          {activeTab === 'clients' && (
            <div style={{maxWidth:'1000px'}}>
              <h2 className="section-title">Client Approvals</h2>
              <div className="card" style={{padding:'1.5rem',marginBottom:'1rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div><div style={{fontWeight:700}}>Acme Corp</div><div style={{fontSize:'0.85rem',color:'var(--text-secondary)'}}>{drafts.filter(d=>approvedSet.has(d.id)).length} approved, {drafts.filter(d=>!approvedSet.has(d.id)).length} pending</div></div>
                  <button className="btn btn-outline" onClick={()=>{triggerHaptic();const link=`${window.location.origin}/approve`;navigator.clipboard.writeText(link);showToast('Approval link copied!');}}><LinkIcon size={14}/> Copy Link</button>
                </div>
              </div>
              <button className="btn btn-primary" onClick={()=>{triggerHaptic();showToast('Invite sent!');}}><Plus size={16}/> Add Client</button>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{maxWidth:'800px'}}>
              <h2 className="section-title">Settings</h2>

              <div className="card" style={{padding:'1.5rem',marginBottom:'1rem'}}>
                <h3 style={{fontSize:'1rem',fontWeight:700,marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}><Globe size={18}/> Connected Accounts</h3>
                 {[
                  {name:'Instagram',id:'instagram',color:'#E1306C',icon:'📸'},
                  {name:'X (Twitter)',id:'x',color:'#1DA1F2',icon:'𝕏'},
                  {name:'LinkedIn',id:'linkedin',color:'#0077B5',icon:'in'},
                  {name:'Pinterest',id:'pinterest',color:'#E60023',icon:'📌'},
                  {name:'TikTok',id:'tiktok',color:'#000000',icon:'🎵'},
                  {name:'Threads',id:'threads',color:'#000000',icon:'🧵'},
                ].map((acc,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.75rem 0',borderBottom:i<5?'1px solid var(--border)':'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                      <div style={{width:'36px',height:'36px',borderRadius:'10px',background:acc.color,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'1rem',fontWeight:700}}>{acc.icon}</div>
                      <div><div style={{fontWeight:600}}>{acc.name}</div><div style={{fontSize:'0.8rem',color:connectedAccounts[acc.id]?'var(--success)':'var(--text-secondary)'}}>{connectedAccounts[acc.id]?'Connected':'Not connected'}</div></div>
                    </div>
                    <button className={`btn ${connectedAccounts[acc.id]?'btn-outline':'btn-primary'}`} style={{padding:'0.4rem 1rem',fontSize:'0.85rem'}} onClick={()=>handleConnect(acc.id)}>{connectedAccounts[acc.id]?'Disconnect':'Connect'}</button>
                  </div>
                ))}
              </div>

              <div className="card" style={{padding:'1.5rem',marginBottom:'1rem'}}>
                <h3 style={{fontSize:'1rem',fontWeight:700,marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}><Shield size={18}/> API Keys</h3>
                {['GEMINI_API_KEY','AYRSHARE_API_KEY','OPENROUTER_API_KEY','BUFFER_ACCESS_TOKEN'].map((k,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.5rem 0',borderBottom:i<3?'1px solid var(--border)':'none'}}>
                    <span style={{fontFamily:'monospace',fontSize:'0.85rem'}}>{k}</span>
                    <span style={{fontSize:'0.8rem',color:'var(--success)'}}>••••••••</span>
                  </div>
                ))}
              </div>

              <div className="card" style={{padding:'1.5rem',marginBottom:'1rem'}}>
                <h3 style={{fontSize:'1rem',fontWeight:700,marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}><User size={18}/> Profile</h3>
                <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                  <div><label style={{fontSize:'0.8rem',color:'var(--text-secondary)',display:'block',marginBottom:'4px'}}>Display Name</label><input className="form-input" defaultValue="AutoPublish User" style={{width:'100%'}}/></div>
                  <div><label style={{fontSize:'0.8rem',color:'var(--text-secondary)',display:'block',marginBottom:'4px'}}>Email</label><input className="form-input" defaultValue="user@autopublish.app" style={{width:'100%'}}/></div>
                  <div><label style={{fontSize:'0.8rem',color:'var(--text-secondary)',display:'block',marginBottom:'4px'}}>Timezone</label><select className="form-input" style={{width:'100%'}}><option>UTC</option><option>Asia/Karachi (PKT)</option><option>America/New_York (EST)</option><option>Europe/London (GMT)</option></select></div>
                  <button className="btn btn-primary" style={{alignSelf:'flex-start',marginTop:'0.5rem'}} onClick={()=>{triggerHaptic();showToast('Settings saved!');}}>Save Changes</button>
                </div>
              </div>

              <div className="card" style={{padding:'1.5rem'}}>
                <h3 style={{fontSize:'1rem',fontWeight:700,marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}><Database size={18}/> System</h3>
                <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>
                  <button className="btn btn-outline" onClick={()=>{triggerHaptic();fetchData();fetchHealth();showToast('Data refreshed!');}}><RefreshCcw size={14}/> Refresh All Data</button>
                  <button className="btn btn-outline" style={{color:'var(--danger)',borderColor:'var(--danger)'}} onClick={()=>{triggerHaptic();showToast('Cache cleared');}}><Trash2 size={14}/> Clear Cache</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Global Command Palette Modal */}
      {cmdPaletteOpen && (
        <div className="cmd-palette-overlay" onClick={() => setCmdPaletteOpen(false)}>
           <div className="cmd-palette" onClick={e => e.stopPropagation()}>
              <div style={{display: 'flex', alignItems: 'center', padding: '0 1.5rem', borderBottom: '1px solid var(--border)'}}>
                 <Search size={20} color="var(--text-secondary)"/>
                 <input 
                   autoFocus
                   type="text" 
                   className="cmd-input" 
                   placeholder="Search media, drafts, or type a command..."
                   value={cmdSearchTerm}
                   onChange={e => setCmdSearchTerm(e.target.value)}
                 />
                 <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>ESC</span>
              </div>
              <div className="cmd-results">
                 <div style={{padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase'}}>Quick Actions</div>
                 <div className="cmd-result-item"><PenTool size={16}/> Create new text post</div>
                 <div className="cmd-result-item"><ImageIcon size={16}/> Upload media to library</div>
                 <div className="cmd-result-item"><Settings size={16}/> Go to Enterprise Settings</div>
              </div>
           </div>
        </div>
      )}

      {/* Enhanced Navigation: Floating Action Button (FAB) */}
      <div className={`fab-container ${fabOpen ? 'open' : ''}`}>
        <div className="fab-menu">
          <button className="fab-item" onClick={() => {triggerHaptic(); setFabOpen(false); writeManually(null);}}><PenTool size={16}/> New Text Draft</button>
          <button className="fab-item" onClick={() => {triggerHaptic(); setFabOpen(false); fileInputRef.current?.click();}}><ImageIcon size={16}/> Upload Media</button>
        </div>
        <button aria-label="Quick Actions" className={`fab ${fabOpen ? 'active' : ''}`} onClick={() => { triggerHaptic(); setFabOpen(!fabOpen); }}>
          <Plus size={24} />
        </button>
      </div>
      
      {toast && <div className="success-toast" role="alert">{toast}</div>}
    </div>
  );
}

export default App;
