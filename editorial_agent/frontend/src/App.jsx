import { useState, useEffect, useRef } from 'react';
import { 
  getDrafts, getQueue, getSchedule, getPostedHistory, uploadImage, 
  updateDraftStatus, deleteDraft, triggerDraftGeneration, saveSchedule,
  engageComment, analyzePerformance
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

  useEffect(() => {
    fetchData();
    
    // Command Palette Listener
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') setCmdPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

             {/* Notifications */}
             <div style={{position: 'relative'}}>
               <button aria-label="Notifications" className="btn-icon" onClick={() => setNotificationsOpen(!notificationsOpen)}>
                 <Bell size={20}/>
                 <div style={{position: 'absolute', top: '2px', right: '4px', width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%'}} />
               </button>
               <div className={`notif-dropdown ${notificationsOpen ? 'open' : ''}`}>
                 <div className="notif-header">Notifications</div>
                 <div className="notif-item"><AlertTriangle size={16} color="var(--danger)" /> <span>Post failed to publish on X. Review API limits.</span></div>
                 <div className="notif-item"><CheckCircle2 size={16} color="var(--success)" /> <span>Client 'Acme Corp' approved 4 drafts.</span></div>
               </div>
             </div>

             {/* Dark Mode Toggle */}
             <button aria-label="Toggle Dark Mode" className="btn-icon" onClick={() => {triggerHaptic(); setIsDarkMode(!isDarkMode);}}>
               {isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}
             </button>

             <button className="btn btn-primary" onClick={() => {triggerHaptic(); showToast("Posts scheduled!");}} disabled={approvedSet.size === 0}>
                Schedule ({approvedSet.size})
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
                             <button className="btn btn-outline" style={{width: '100%'}}><RefreshCw size={14}/> Rewrite with AI</button>
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

          {activeTab === 'inbox' && (
            <div style={{maxWidth: '1000px'}}>
              <h2 className="section-title">Command Center (Smart Inbox)</h2>
              <div className="card" style={{padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)'}}>Inbox content is hidden in this simplified view.</div>
            </div>
          )}
          
          {activeTab === 'listening' && (
            <div style={{maxWidth: '1000px'}}>
              <h2 className="section-title">Brand Sentiment</h2>
              <div className="card" style={{padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)'}}>Listening data loaded.</div>
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
